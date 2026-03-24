# useMode.ts

**Archivo:** `src/hooks/useMode.ts`
**Rol:** Hook que determina automáticamente a qué servidor conectarse al iniciar la app, y expone funciones para cambiar de servidor o volver a escanear la red.

---

## Constante

```ts
const LOCALHOST = 'http://localhost:3001';
```

URL por defecto cuando no se encuentra ningún servidor en la red.

---

## Función auxiliar `normalize`

```ts
function normalize(url: string): string {
  return url.trim().replace(/\/$/, '');
}
```

Elimina espacios y la barra final de una URL. `replace(/\/$/, '')` usa regex: `/$` significa "barra al final del string". Así `"http://192.168.1.5:3001/"` se normaliza a `"http://192.168.1.5:3001"`.

---

## Función auxiliar `isLocalContext`

```ts
function isLocalContext(): boolean {
  const h = window.location.hostname;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === 'tauri.localhost' ||
    '__TAURI_INTERNALS__' in window
  );
}
```

Determina si la app se está ejecutando "localmente" (en la misma máquina que el servidor):
- `localhost` / `127.0.0.1`: navegador en la misma máquina.
- `tauri.localhost`: dominio virtual que usa Tauri en macOS/Linux.
- `__TAURI_INTERNALS__`: runtime de Tauri.

Si retorna `false`, significa que el usuario accedió a la app desde un celular u otro dispositivo vía IP LAN — en ese caso, el servidor ya se conoce desde `window.location`.

---

## Hook `useMode`

### Estado

```ts
const [serverUrl, setServerUrl] = useState<string | null>(null);
const [connecting, setConnecting] = useState(true);
```

- `serverUrl`: URL del backend activo. Empieza en `null` hasta que se determine.
- `connecting`: `true` mientras la app busca el servidor. Controla si se muestra `ConnectingScreen`.

### Efecto de auto-conexión

```ts
useEffect(() => {
  let cancelled = false;

  async function autoConnect() {
    // Caso 1: Tauri — siempre su propio servidor local
    if (isTauriApp()) {
      if (!cancelled) { setServerUrl(LOCALHOST); setConnecting(false); }
      return;
    }

    // Caso 2: Navegador accediendo desde un dispositivo remoto
    if (!isLocalContext()) {
      if (!cancelled) { setServerUrl(normalize(getApiUrl())); setConnecting(false); }
      return;
    }

    // Caso 3: localhost en el navegador (modo dev) — necesita escanear
    let servers: DiscoveredServer[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        servers = await scanNetwork();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (cancelled) return;
    setServerUrl(normalize(servers.length > 0 ? servers[0].url : LOCALHOST));
    setConnecting(false);
  }

  autoConnect();
  return () => { cancelled = true; };
}, []);
```

#### Tres rutas de auto-conexión

| Caso | Contexto | Solución |
|---|---|---|
| 1 | Tauri | Siempre conecta a `localhost:3001` (su propio sidecar). |
| 2 | Navegador en IP LAN | La URL actual ya tiene la IP correcta — solo se normaliza. |
| 3 | `localhost` en dev | Escanea la red para encontrar el backend. |

#### Patrón `cancelled`

```ts
let cancelled = false;
...
return () => { cancelled = true; };
```

Previene "race conditions": si el componente se desmonta mientras `autoConnect` sigue ejecutándose, `cancelled = true` evita que se llame a `setServerUrl` o `setConnecting` en un componente ya desmontado.

#### Reintentos en el escaneo

```ts
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    servers = await scanNetwork();
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
```

Intenta escanear hasta 6 veces con 500ms de pausa entre intentos. Útil si el backend tarda un poco en arrancar.

---

## Función `connect`

```ts
const connect = useCallback((url: string) => {
  setServerUrl(normalize(url));
}, []);
```

Cambia el servidor activo. Al actualizar `serverUrl`, todos los hooks que dependen de él (`useFiles`, `useTransfer`) se re-inicializan automáticamente.

---

## Función `rescan`

```ts
const rescan = useCallback(async () => {
  return scanNetwork().catch(() => [] as DiscoveredServer[]);
}, []);
```

Dispara un escaneo de la red y devuelve los resultados. Si falla, retorna un array vacío en lugar de propagar el error. Se usa en `ServerSwitcherModal` para actualizar la lista de servidores disponibles.
