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
  copyUrl: string | null;            // URL del frontend (puede diferir del backend en dev)
  serverClients: TransferClient[];   // Servidores vistos vía WebSocket relay (isServer=true)
  localLanIp: string | null;         // IP LAN del equipo local (Tauri). Persiste al conectarse a un servidor remoto.
  onConnect: (url: string) => void;  // Cambiar de servidor
  onRescan: () => Promise<DiscoveredServer[]>; // Escanear la red
}
```

---

## Estado interno

```tsx
const [scanning, setScanning] = useState(false);
const [scanned, setScanned] = useState<DiscoveredServer[]>([]);
const [sameServerMsg, setSameServerMsg] = useState(false);
const ipInputRef = useRef<HTMLInputElement>(null);

// Pre-auth (Tauri)
const [pendingUrl, setPendingUrl] = useState<string | null>(null);
const [connectPin, setConnectPin] = useState('');
const [connectPinError, setConnectPinError] = useState<string | null>(null);
const [connecting, setConnecting] = useState(false);
const pinInputRef = useRef<HTMLInputElement>(null);
```

- `scanning`: si el escaneo de red está en curso.
- `scanned`: resultados del último escaneo.
- `sameServerMsg`: muestra un mensaje cuando el usuario intenta conectarse al servidor al que ya está conectado.
- `pendingUrl`: URL del servidor remoto al que se quiere conectar, esperando confirmación de PIN (Tauri).
- `connectPin` / `connectPinError` / `connecting`: estado del formulario de PIN pre-auth.

---

## Efecto: escanear al abrir y resetear PIN

```tsx
useEffect(() => {
  if (!isOpen) return;
  setScanned([]);
  setScanning(true);
  setSameServerMsg(false);
  setPendingUrl(null);
  setConnectPin('');
  setConnectPinError(null);
  onRescan().then((results) => {
    setScanned(results);
    setScanning(false);
  });
}, [isOpen]);
```

Cada vez que el modal se abre: inicia un escaneo automático, y resetea completamente el estado del PIN (campo, error, URL pendiente). Esto garantiza que el formulario de PIN siempre empiece limpio.

---

## Early return

```tsx
if (!isOpen) return null;
```

El modal no existe en el DOM mientras está cerrado.

---

## Fusión de fuentes de servidores

Los servidores visibles en la lista "Otros servidores" provienen de **dos fuentes** que se fusionan para evitar duplicados, excluyendo el servidor actual:

### Fuente 1: relay WebSocket (tiempo real)

```tsx
const relayServers = serverClients
  .filter((c) => c.isServer && c.ip !== currentIp)
  .map((c) => ({ ip: c.ip, url: `http://${c.ip}:3001`, appName: c.appName }));
```

Servidores detectados porque están conectados al mismo relay WebSocket.

### Fuente 2: escaneo HTTP de la red

```tsx
const scannedFiltered = scanned.filter(
  (s) => s.ip !== currentIp && !relayServers.some((r) => r.ip === s.ip)
);
```

Servidores encontrados por escaneo HTTP de la subnet, desduplicados contra el relay.

### Resultado combinado

```tsx
const otherServers: DiscoveredServer[] = [...relayServers, ...scannedFiltered];
```

### "Este equipo" en Tauri

Cuando se está conectado a un servidor remoto en Tauri, se inserta al principio de la lista una entrada "Este equipo" que apunta al `localLanIp` del equipo local (guardado antes de cambiar de servidor):

```tsx
if (isTauriApp() && localLanIp && !isOnOwnServer) {
  otherServers.unshift({ ip: localLanIp, url: `http://${localLanIp}:3001`, appName: 'Este equipo' });
}
```

Esto permite volver al servidor propio sin saber su IP de memoria.

---

## Función `handleConnect`

```tsx
function handleConnect(url: string) {
  // En navegador: abre en nueva pestaña
  if (!isTauriApp()) {
    window.open(url, '_blank');
    return;
  }

  // Tauri conectando al servidor propio o localhost: no necesita PIN (auto-auth)
  const isLocal = url === LOCALHOST_URL || url.includes('localhost')
    || url.includes('127.0.0.1')
    || (localLanIp !== null && url.includes(localLanIp));
  if (isLocal) {
    onConnect(url);
    onClose();
    return;
  }

  // Tauri → servidor remoto: pedir PIN antes de cambiar contexto
  setPendingUrl(url);
  setConnectPin('');
  setConnectPinError(null);
}
```

El comportamiento difiere según entorno y destino:
- **Navegador**: abre la URL en nueva pestaña.
- **Tauri → servidor propio** (localhost, 127.0.0.1, o `localLanIp`): cambia directamente sin PIN.
- **Tauri → servidor remoto**: muestra el prompt de PIN antes de cambiar contexto (pre-auth).

---

## Flujo de pre-autenticación (Tauri)

Cuando `pendingUrl` tiene un valor, el modal muestra el prompt de PIN en lugar del contenido normal. El usuario ingresa el PIN de 6 dígitos y confirma:

```tsx
async function handleConnectWithPin() {
  if (!pendingUrl || !connectPin.trim()) return;
  setConnecting(true);
  const ok = await authenticate(pendingUrl, connectPin.trim());
  setConnecting(false);
  if (ok) {
    onConnect(pendingUrl);
    onClose();
  } else {
    setConnectPinError('PIN incorrecto. Intentá de nuevo.');
  }
}
```

`authenticate()` (de `lib/auth`) envía el PIN al servidor remoto para obtener un token antes de que el contexto de la app cambie. Esto evita que la app quede en un estado intermedio con un servidor sin autenticar.

---

## Prompt de PIN (overlay)

```tsx
if (pendingUrl) {
  return (
    <div className="modal-overlay" onClick={handleCancelPending}>
      <div className="pin-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pin-modal__close" onClick={handleCancelPending}>✕</button>
        <h3 className="pin-modal__title">Conectarse a servidor</h3>
        <p className="pin-modal__subtitle">
          Ingrese el pin del servidor <span className="pin-modal__host">{pendingDisplay}</span> para conectarse
        </p>
        <form className="pin-modal__row" onSubmit={...}>
          <input className="pin-modal__input" ... />
          <button type="submit" className="btn btn--primary btn--sm">Conectar</button>
        </form>
        {connectPinError && <p className="pin-modal__error">{connectPinError}</p>}
      </div>
    </div>
  );
}
```

Usa las mismas clases CSS que `PinDialog` (`pin-modal`, `pin-modal__row`, `pin-modal__input`). El input y el botón "Conectar" están en la misma fila con altura y border-radius coincidentes.

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

Permite conectarse a una IP escrita manualmente. Normaliza la entrada agregando protocolo y puerto si faltan. Si la IP ingresada coincide con el servidor actual, muestra el mensaje `sameServerMsg`.

---

## Estructura visual del modal

1. **Header**: título "Servidores" + botón de cerrar (✕).
2. **Sección "Conectado"**: muestra siempre dos filas de URL:
   - **Servidor** (backend IP:puerto) — con icono de server rack y botón copiar.
   - **Web** (frontend IP:puerto) — con icono de globo y botón copiar.
3. **Divider**.
4. **Otros servidores**: lista fusionada (relay + escaneo) con spinner mientras escanea. Incluye "Este equipo" si se está conectado a un servidor remoto en Tauri.
5. **Divider**.
6. **Conexión manual**: input de IP + botón "Conectar" en la misma fila.
7. **Botón "Volver a escanear"**.

---

## Chip en el header (App.tsx)

El botón que abre este modal en el header muestra:
- Un icono de server rack (SVG).
- El texto fijo **"Servidor"** (no la IP raw).
- Opcionalmente, el PIN del servidor local (icono candado + número).
- Un chevron hacia abajo.
