# useTransfer.ts

**Archivo:** `src/hooks/useTransfer.ts`
**Rol:** Hook que gestiona la conexión WebSocket para transferencias directas P2P entre dispositivos. Es el núcleo del sistema de envío de archivos.

---

## Tipo `ActiveTransfer`

```ts
export interface ActiveTransfer {
  transferId: string;
  fileName: string;
  fileSize: number;
  progress: number;          // 0–100
  direction: 'sending' | 'receiving';
  peerName: string;          // Nombre del otro dispositivo
  peerId: string;            // clientId del otro dispositivo
  waiting: boolean;          // true mientras el receptor no aceptó/rechazó
}
```

Representa una transferencia en curso (ya sea enviando o recibiendo).

---

## Hook `useTransfer`

```ts
export function useTransfer(
  serverUrl: string,
  appName: string,
  onFileReceived: (fileName, mimeType, blob) => void,
  onSendRejected?: () => void
)
```

| Parámetro | Descripción |
|---|---|
| `serverUrl` | URL del backend. Al cambiar, se reinicia la conexión WebSocket. |
| `appName` | Nombre del dispositivo. Se lee de un `ref` para no reconectar al cambiar. |
| `onFileReceived` | Callback llamado cuando se recibe un archivo completo. |
| `onSendRejected` | Callback opcional cuando el receptor rechaza el envío. |

---

## Variables internas (refs)

```ts
const connRef = useRef<TransferConnection | null>(null);
const pendingSendRef = useRef<{ transferId, file, peerId } | null>(null);
const receiveBuffers = useRef(new Map<string, { chunks, received, total, fileName, mimeType }>());
const onFileReceivedRef = useRef(onFileReceived);
const onSendRejectedRef = useRef(onSendRejected);
const appNameRef = useRef(appName);
```

### ¿Por qué refs para los callbacks?

```ts
useEffect(() => { onFileReceivedRef.current = onFileReceived; });
useEffect(() => { onSendRejectedRef.current = onSendRejected; });
useEffect(() => { appNameRef.current = appName; });
```

Los callbacks (`onFileReceived`, `onSendRejected`) y `appName` se guardan en refs y se actualizan en cada render **sin que esto cause una reconexión**. Si se usaran directamente como dependencias del efecto principal, cambiar el nombre del dispositivo o el callback cerraría y reabriera el WebSocket innecesariamente.

### `receiveBuffers`

Un `Map` que actúa como buffer de recepción. Por cada transferencia entrante activa, guarda:
- `chunks`: array de `ArrayBuffer` (fragmentos del archivo recibidos hasta ahora).
- `received`: bytes recibidos acumulados.
- `total`: tamaño total esperado del archivo.
- `fileName` / `mimeType`: para reconstruir el archivo al final.

---

## Efecto principal: gestión de la conexión WebSocket

```ts
useEffect(() => {
  const conn = new TransferConnection(serverUrl);
  connRef.current = conn;
  ...
  return () => {
    conn.close();
    connRef.current = null;
    pendingSendRef.current = null;
    receiveBuffers.current.clear();
  };
}, [serverUrl]);
```

Se crea una nueva conexión solo cuando `serverUrl` cambia. Al desmontar, cierra el WebSocket y limpia el estado.

### Registro inicial

```ts
conn.ws.onopen = () => {
  conn.register(appNameRef.current, isTauriApp());
  conn.setReceiving(true);
};
```

Cuando el WebSocket abre:
1. Envía `hello` al servidor con el nombre y si es un servidor Tauri.
2. Activa `set-receiving: true` para indicar que este cliente puede recibir archivos.

### Manejadores de mensajes

| Mensaje | Acción |
|---|---|
| `welcome` | Guarda el `clientId` asignado por el servidor. |
| `clients` | Actualiza la lista de dispositivos conectados. |
| `send-request` | Guarda la solicitud entrante en `incomingRequest` (aparece el modal). |
| `send-accept` | El receptor aceptó: empieza a enviar el archivo en chunks. |
| `send-reject` | El receptor rechazó: limpia el estado y llama a `onSendRejected`. |
| `send-cancel` | El otro dispositivo canceló: limpia buffers y estado. |
| `send-complete` | Todos los chunks llegaron: ensambla el blob y llama a `onFileReceived`. |

### Manejador de datos binarios

```ts
conn.onBinary((buf) => {
  const transferId = new TextDecoder().decode(buf.slice(0, 36)).trim();
  const chunk = buf.slice(36);
  const entry = receiveBuffers.current.get(transferId);
  if (!entry) return;
  entry.chunks.push(chunk);
  entry.received += chunk.byteLength;
  const progress = Math.round((entry.received / entry.total) * 100);
  setActiveTransfer((prev) => prev ? { ...prev, progress } : null);
});
```

Cada frame binario tiene un prefijo de 36 bytes con el `transferId`. El handler:
1. Extrae el ID.
2. Obtiene el buffer de esa transferencia.
3. Agrega el chunk al array.
4. Actualiza el progreso.

---

## Función `rename`

```ts
const rename = useCallback((newName: string) => {
  appNameRef.current = newName;
  connRef.current?.rename(newName);
}, []);
```

Actualiza el nombre en la ref local y lo notifica al servidor. No reconecta el WebSocket.

---

## Función `sendFileTo`

```ts
const sendFileTo = useCallback((toClientId, file, peerName) => {
  const conn = connRef.current;
  if (!conn) return;
  const transferId = generateUUID();  // Fallback seguro para contextos HTTP/LAN
  pendingSendRef.current = { transferId, file, peerId: toClientId };
  setActiveTransfer({
    transferId, fileName: file.name, fileSize: file.size,
    progress: 0, direction: 'sending', peerName, peerId: toClientId,
    waiting: true,   // Esperando que el receptor acepte
  });
  conn.sendRequest(toClientId, file, transferId);
}, []);
```

Inicia un envío: genera un UUID para la sesión con `generateUUID()` (que usa `crypto.randomUUID()` cuando está disponible y un fallback con `Math.random()` en contextos HTTP/LAN donde `crypto.randomUUID` no está disponible), guarda el archivo en `pendingSendRef`, y envía el `send-request` al servidor. El estado `waiting: true` indica que todavía no se aceptó.

Cuando llega `send-accept`, el efecto principal lo maneja:
```ts
conn.on('send-accept', async (msg) => {
  setActiveTransfer((prev) => prev ? { ...prev, waiting: false } : null);
  await conn.sendFile(pending.transferId, pending.file, (pct) => {
    setActiveTransfer((prev) => prev ? { ...prev, progress: pct } : null);
  });
  pendingSendRef.current = null;
  setActiveTransfer(null);
});
```

---

## Función `acceptTransfer`

```ts
const acceptTransfer = useCallback(() => {
  const req = incomingRequest;
  const conn = connRef.current;
  if (!req || !conn) return;
  receiveBuffers.current.set(req.transferId, {
    chunks: [], received: 0, total: req.fileSize,
    fileName: req.fileName, mimeType: req.mimeType,
  });
  setActiveTransfer({ ..., direction: 'receiving', waiting: false });
  conn.accept(req.transferId);
  setIncomingRequest(null);
}, [incomingRequest]);
```

Acepta la solicitud entrante:
1. Inicializa el buffer de recepción para esa transferencia.
2. Marca la transferencia como activa.
3. Notifica al servidor (`conn.accept`).
4. Cierra el modal de solicitud.

---

## Funciones `rejectTransfer` y `cancelTransfer`

```ts
const rejectTransfer = useCallback(() => {
  conn.reject(req.transferId);
  setIncomingRequest(null);
}, [incomingRequest]);

const cancelTransfer = useCallback(() => {
  conn.cancel(transfer.transferId);
  receiveBuffers.current.delete(transfer.transferId);
  pendingSendRef.current = null;
  setActiveTransfer(null);
}, [activeTransfer]);
```

- **Rechazar**: notifica al servidor y cierra el modal.
- **Cancelar**: notifica al servidor, limpia buffers locales, y resetea el estado.
