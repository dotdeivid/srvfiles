# transfer.api.ts

**Archivo:** `src/api/transfer.api.ts`
**Rol:** Clase `TransferConnection` que encapsula toda la lógica de comunicación WebSocket para transferencias P2P. También define los tipos y una función utilitaria.

---

## Tipos

### `TransferClient`

```ts
export interface TransferClient {
  clientId: string;
  appName: string;
  receiving: boolean;       // ¿Está disponible para recibir archivos?
  ip: string;
  deviceType: 'mobile' | 'desktop';
  isServer: boolean;        // ¿Es un servidor Tauri?
}
```

Representa un dispositivo conectado al relay, tal como lo reporta el servidor.

### `IncomingTransferRequest`

```ts
export interface IncomingTransferRequest {
  transferId: string;
  from: string;       // clientId del remitente
  fromName: string;   // Nombre del remitente
  fileName: string;
  fileSize: number;
  mimeType: string;
}
```

Los datos de una solicitud de transferencia entrante, para mostrar en el modal.

### `ServerMessage` (tipo unión)

```ts
type ServerMessage =
  | { type: 'welcome'; clientId: string }
  | { type: 'clients'; clients: TransferClient[] }
  | { type: 'send-request'; ... }
  | { type: 'send-accept'; transferId: string }
  | { type: 'send-reject'; transferId: string; reason?: string }
  | { type: 'send-cancel'; transferId: string }
  | { type: 'send-complete'; transferId: string };
```

Un **tipo unión discriminado**: cada variante tiene un `type` diferente. TypeScript puede inferir todos los campos disponibles dependiendo del `type`, lo que hace el código seguro sin casteos manuales.

---

## Constante `CHUNK_SIZE`

```ts
const CHUNK_SIZE = 256 * 1024; // 256 KB
```

Tamaño de cada fragmento al enviar un archivo. 256 KB es un balance entre eficiencia (pocos mensajes) y no bloquear el event loop (frames demasiado grandes en WebSocket pueden causar lag).

---

## Clase `TransferConnection`

### Constructor

```ts
constructor(serverUrl: string) {
  const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
  this.ws = new WebSocket(wsUrl);
  this.ws.binaryType = 'arraybuffer';

  this.ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      this.binaryHandlers.forEach((h) => h(event.data));
      return;
    }
    try {
      const msg = JSON.parse(event.data) as ServerMessage;
      if (msg.type === 'welcome') this.clientId = msg.clientId;
      this.handlers.get(msg.type)?.(msg);
    } catch { }
  };
}
```

- Convierte la URL HTTP a WebSocket: `http://192.168.1.5:3001` → `ws://192.168.1.5:3001/ws`.
- `binaryType = 'arraybuffer'`: le dice al WebSocket que los mensajes binarios lleguen como `ArrayBuffer` (en vez de `Blob`), más eficiente para procesamiento directo.
- En el manejador de mensajes: si es binario, lo pasa a todos los `binaryHandlers`; si es texto, lo parsea como JSON y lo enruta al handler del tipo correspondiente.

### Método `on`

```ts
on<T extends ServerMessage['type']>(
  type: T,
  handler: (msg: Extract<ServerMessage, { type: T }>) => void
) {
  this.handlers.set(type, handler as any);
  return this;
}
```

Registra un handler para un tipo de mensaje. El tipo genérico `T` y `Extract<...>` hacen que TypeScript conozca exactamente qué campos tiene `msg` para cada tipo. Ejemplo:

```ts
conn.on('send-request', (msg) => {
  // TypeScript sabe que msg tiene: from, fromName, fileName, fileSize, mimeType, transferId
});
```

### Método `onBinary`

```ts
onBinary(handler: (buf: ArrayBuffer) => void) {
  this.binaryHandlers.push(handler);
  return this;
}
```

Registra un handler para frames binarios (chunks de archivo). A diferencia de `on`, permite múltiples handlers.

### Método `sendJson` (privado)

```ts
private sendJson(msg: object) {
  if (this.ws.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify(msg));
  }
}
```

Todos los mensajes de señalización (JSON) pasan por aquí. La verificación `readyState === WebSocket.OPEN` evita errores al intentar enviar en un socket cerrado.

### Métodos de señalización

| Método | Mensaje enviado | Propósito |
|---|---|---|
| `register(appName, isServer)` | `hello` | Registrarse en el servidor con nombre y tipo. |
| `setReceiving(bool)` | `set-receiving` | Indicar disponibilidad para recibir. |
| `sendRequest(to, file, id)` | `send-request` | Pedir permiso al receptor para enviar un archivo. |
| `accept(transferId)` | `send-accept` | Aceptar una solicitud entrante. |
| `reject(transferId)` | `send-reject` | Rechazar una solicitud entrante. |
| `cancel(transferId)` | `send-cancel` | Cancelar una transferencia activa. |
| `rename(newName)` | `rename` | Cambiar el nombre visible sin reconectar. |

### Método `sendFile`

```ts
async sendFile(transferId: string, file: File, onProgress?: (pct: number) => void) {
  const encoder = new TextEncoder();
  const idBytes = encoder.encode(transferId.padEnd(36, ' ').slice(0, 36));
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const chunkBuf = await file.slice(offset, end).arrayBuffer();
    const frame = new Uint8Array(36 + chunkBuf.byteLength);
    frame.set(idBytes, 0);          // Primeros 36 bytes: el transferId
    frame.set(new Uint8Array(chunkBuf), 36);  // El resto: el chunk del archivo
    this.ws.send(frame.buffer);
    offset = end;
    onProgress?.(Math.round((offset / file.size) * 100));
    await new Promise((r) => setTimeout(r, 0));  // Yield al event loop
  }
  this.sendJson({ type: 'send-complete', transferId });
}
```

#### Estructura de cada frame binario

```
[ 36 bytes: transferId (ASCII, padded con espacios) ][ N bytes: chunk del archivo ]
```

El servidor usa los primeros 36 bytes para saber a qué receptor enviar cada frame.

#### Por qué `file.slice(...).arrayBuffer()`

`File.slice(start, end)` crea un `Blob` que representa un fragmento del archivo sin leerlo todavía. `.arrayBuffer()` lee esos bytes en memoria. Leer en fragmentos evita cargar todo el archivo en RAM de una vez.

#### `await new Promise((r) => setTimeout(r, 0))`

Cede el control al event loop entre chunks. Sin esto, enviar un archivo grande bloquearía la UI (no se podrían actualizar barras de progreso, ni responder a eventos de usuario) hasta que termine el loop.

---

## Función utilitaria `getTransferWsUrl`

```ts
export function getTransferWsUrl(serverUrl?: string): string {
  return (serverUrl || getApiUrl()).replace(/^http/, 'ws') + '/ws';
}
```

Convierte cualquier URL HTTP de servidor en su endpoint WebSocket correspondiente.
