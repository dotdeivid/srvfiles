# useAuth.ts

**Archivo:** `src/hooks/useAuth.ts`
**Rol:** Gestiona la autenticación para un servidor dado. Para servidores locales (localhost / Tauri), obtiene el PIN automáticamente y autentica sin intervención del usuario. Para servidores remotos, abre el `PinDialog`.

---

## Tipo de retorno

```ts
interface UseAuthReturn {
  authenticated: boolean;
  pinDialogOpen: boolean;
  pinError: string | null;
  serverPin: string | null;   // PIN en texto plano (solo para servidores locales)
  submitPin: (pin: string) => Promise<void>;
}
```

---

## Hook `useAuth`

```ts
export function useAuth(serverUrl: string): UseAuthReturn
```

Recibe la URL del servidor. Al cambiar (cambio de servidor), resetea el estado y re-evalúa el flujo de autenticación.

---

## Función `isSameMachine`

```ts
const isSameMachine = useCallback((url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'tauri.localhost'
    );
  } catch { return false; }
}, []);
```

Retorna `true` solo cuando la URL apunta al mismo equipo (loopback o Tauri). **No incluye** `window.location.hostname === hostname` — esa comparación sería una tautología cuando la página es servida por el mismo servidor, haciendo que cualquier IP LAN parezca "local".

---

## Función `toPinUrl`

```ts
const toPinUrl = useCallback((url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.hostname = 'localhost';
    return `${parsed.origin}/api/pin`;
  } catch {
    return `${url}/api/pin`;
  }
}, []);
```

Construye la URL del endpoint `/api/pin` reemplazando el hostname por `localhost`. Necesario para que el backend acepte la petición (el endpoint solo responde a loopback).

---

## Efecto principal: flujo de autenticación

```ts
useEffect(() => {
  if (isSameMachine(serverUrl)) {
    // Servidor local: obtener PIN automáticamente y autenticar
    fetch(toPinUrl(serverUrl))
      .then(r => r.json())
      .then(async ({ pin }) => {
        setServerPin(pin);
        // Re-autenticar siempre: el servidor puede haber reiniciado con PIN nuevo
        const ok = await authenticate(serverUrl, pin);
        if (ok) setAuthenticated(true);
        else setPinDialogOpen(true);
      })
      .catch(() => {
        if (!getToken()) setPinDialogOpen(true);
      });
    return;
  }

  // Servidor remoto: si ya hay token válido, usar; si no, pedir PIN
  if (getToken()) {
    setAuthenticated(true);
    return;
  }
  setPinDialogOpen(true);
}, [serverUrl, isSameMachine, toPinUrl]);
```

### Flujo para servidor local (Tauri / relay mobile)
1. Llama a `GET /api/pin` por localhost.
2. Muestra el PIN en el header (para que el usuario lo comparta con otros).
3. Se autentica automáticamente (siempre re-autentica por si el servidor reinició).

### Flujo para servidor remoto
1. Si hay token en `sessionStorage`, da por autenticado.
2. Si no, abre el `PinDialog`.

---

## Efecto de re-evaluación (polling de sessionStorage)

```ts
useEffect(() => {
  if (!authenticated) return;
  const id = setInterval(() => {
    if (!getToken()) {
      setAuthenticated(false);
      setPinDialogOpen(true);
    }
  }, 2000);
  return () => clearInterval(id);
}, [authenticated]);
```

Verifica cada 2 segundos si el token fue eliminado externamente (por ejemplo, al recibir un 401 desde `useFiles`). Si desapareció, vuelve a pedir el PIN.

---

## Función `submitPin`

```ts
const submitPin = useCallback(async (pin: string) => {
  setPinError(null);
  const ok = await authenticate(serverUrl, pin);
  if (ok) {
    setAuthenticated(true);
    setPinDialogOpen(false);
  } else {
    setPinError('PIN incorrecto. Intentá de nuevo.');
  }
}, [serverUrl]);
```

Llama a `POST /api/auth` con el PIN. En éxito, cierra el diálogo. En fallo, muestra el error dentro del mismo diálogo.
