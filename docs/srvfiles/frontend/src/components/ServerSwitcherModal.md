# ServerSwitcherModal.tsx

**Archivo:** `src/components/ServerSwitcherModal.tsx`
**Rol:** Modal para ver el servidor actualmente conectado, descubrir otros servidores SrvFiles en la red, y conectarse a ellos.

---

## Props

```tsx
interface ServerSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentServerUrl: string;          // URL del backend activo (con IP LAN real, ej: 192.168.1.5:3001)
  copyUrl: string | null;            // URL para copiar al clipboard (puede ser la URL del frontend)
  serverClients: TransferClient[];   // Servidores vistos vía WebSocket relay
  onConnect: (url: string) => void;  // Cambiar de servidor
  onRescan: () => Promise<DiscoveredServer[]>; // Escanear la red
}
```

---

## Estado interno

```tsx
const [scanning, setScanning] = useState(false);
const [scanned, setScanned] = useState<DiscoveredServer[]>([]);
const [copied, setCopied] = useState(false);
const ipInputRef = useRef<HTMLInputElement>(null);
```

- `scanning`: si el escaneo de red está en curso.
- `scanned`: resultados del último escaneo.
- `copied`: feedback visual (el ícono del botón de copiar cambia por 2 segundos).
- `ipInputRef`: referencia al input de IP manual.

---

## Función `handleCopy`

```tsx
function handleCopy() {
  const url = copyUrl ?? currentServerUrl;
  navigator.clipboard.writeText(url).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);  // Resetea el ícono después de 2 segundos
  });
}
```

Copia la URL al portapapeles del sistema usando la API moderna `navigator.clipboard`. El operador `??` (nullish coalescing) usa `copyUrl` si existe, o `currentServerUrl` como fallback.

---

## Efecto: escanear al abrir

```tsx
useEffect(() => {
  if (!isOpen) return;
  setScanned([]);
  setScanning(true);
  onRescan().then((results) => {
    setScanned(results);
    setScanning(false);
  });
}, [isOpen]);
```

Cada vez que el modal se abre, automáticamente inicia un escaneo de la red. Mientras el escaneo corre, `scanning` es `true` y se muestra un spinner.

---

## Early return

```tsx
if (!isOpen) return null;
```

El modal no existe en el DOM mientras está cerrado.

---

## Fusión de fuentes de servidores

Los servidores visibles en el modal provienen de **dos fuentes** que se fusionan para evitar duplicados:

### Fuente 1: relay WebSocket (tiempo real)

```tsx
const currentIp = currentServerUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
const relayServers = serverClients
  .filter((c) => c.isServer && c.ip !== currentIp)
  .map((c) => ({ ip: c.ip, url: `http://${c.ip}:3001`, appName: c.appName }));
```

Servidores detectados porque están conectados al mismo relay WebSocket. Son los más confiables (actualizados en tiempo real). Se filtra el servidor actual para no mostrarlo como "otro".

### Fuente 2: escaneo HTTP de la red

```tsx
const scannedFiltered = scanned.filter(
  (s) => s.ip !== currentIp && !relayServers.some((r) => r.ip === s.ip)
);
```

Servidores encontrados por el escaneo HTTP de la subnet. Se filtran los que ya están en `relayServers` para no mostrar duplicados.

### Resultado combinado

```tsx
const otherServers: DiscoveredServer[] = [...relayServers, ...scannedFiltered];
```

---

## Función `handleConnect`

```tsx
function handleConnect(url: string) {
  if (isTauriApp()) {
    onConnect(url);   // En Tauri: cambia el servidor interno y cierra el modal
    onClose();
  } else {
    window.open(url, '_blank');  // En el navegador: abre en nueva pestaña
  }
}
```

El comportamiento difiere según el entorno:
- **Tauri**: el servidor puede cambiar sin recargar la app porque todo está en memoria.
- **Navegador web**: no hay una "conexión activa" que cambiar — simplemente abre la URL del otro servidor en una pestaña nueva.

---

## Función `handleManualConnect`

```tsx
function handleManualConnect() {
  const raw = ipInputRef.current?.value.trim() ?? '';
  if (!raw) return;
  let url = raw;
  if (!url.startsWith('http')) url = `http://${url}`;
  if (!/:\d+$/.test(url)) url = `${url}:3001`;
  handleConnect(url);
}
```

Permite conectarse a una IP escrita manualmente. Normaliza la entrada:
1. Si no empieza con `http`, agrega `http://`.
2. Si no tiene puerto (`:XXXX`), agrega `:3001`.

---

## Función `handleRescan`

```tsx
function handleRescan() {
  setScanning(true);
  setScanned([]);
  onRescan().then((results) => {
    setScanned(results);
    setScanning(false);
  });
}
```

Repite el escaneo manualmente al hacer clic en "Volver a escanear".

---

## Estructura visual del modal

1. **Header**: título "Servidores" + botón de cerrar (✕).
2. **Servidor conectado**: muestra la IP actual con botón de copiar.
3. **Divider**.
4. **Otros servidores**: lista de servidores descubiertos (o spinner si está escaneando).
5. **Divider**.
6. **Conexión manual**: input de IP + botón "Conectar".
7. **Botón "Volver a escanear"**.
