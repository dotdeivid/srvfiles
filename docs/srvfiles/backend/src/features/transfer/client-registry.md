# client-registry.ts

**Archivo:** `src/features/transfer/client-registry.ts`
**Rol:** Registro en memoria de clientes WebSocket conectados y sesiones de transferencia activas. Expone funciones CRUD para que `transfer.handler.ts` manipule el estado, y funciones de broadcast para notificar a todos los clientes.

---

## Estado en módulo

```ts
const clients = new Map<string, ConnectedClient>();
const transfers = new Map<string, TransferSession>();
```

Dos `Map` en memoria que persisten mientras el proceso está corriendo:
- `clients`: todos los dispositivos conectados, indexados por `clientId` (UUID).
- `transfers`: sesiones de transferencia activas, indexadas por `transferId`.

---

## Gestión de clientes

```ts
export function addClient(clientId: string, client: ConnectedClient): void
export function removeClient(clientId: string): void
export function getClient(clientId: string): ConnectedClient | undefined
```

CRUD simple sobre el `Map` de clientes. `getClient` devuelve `undefined` si el clientId no existe.

---

## Gestión de sesiones de transferencia

```ts
export function addTransfer(transferId: string, session: TransferSession): void
export function getTransfer(transferId: string): TransferSession | undefined
export function removeTransfer(transferId: string): void
```

CRUD sobre el `Map` de transferencias. Las sesiones se crean en `send-request`, se limpian en `send-reject`, `send-cancel` y `send-complete`.

---

## `sendToClient`

```ts
export function sendToClient(ws: WebSocket, msg: object, cipher: SessionCipher | null): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (!cipher) {
    ws.send(JSON.stringify(msg));
    return;
  }
  void cipher.encryptJson(JSON.stringify(msg)).then(({ iv, data }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'encrypted', iv, data }));
    }
  });
}
```

Envía un mensaje JSON a un WebSocket específico. Si el cliente tiene un `cipher` activo (ECDH negociado), cifra el payload con AES-256-GCM antes de enviarlo. El mensaje cifrado tiene la forma `{ type: 'encrypted', iv: string, data: string }` en base64.

La verificación `readyState !== WebSocket.OPEN` evita errores al intentar enviar en una conexión cerrada.

---

## `broadcastClients`

```ts
export function broadcastClients(): void {
  const list = Array.from(clients.values()).map((c) => ({
    clientId: c.clientId,
    appName: c.appName,
    receiving: c.receiving,
    ip: c.ip,
    deviceType: c.deviceType,
    isServer: c.isServer,
  }));
  const msg = { type: 'clients', clients: list };
  for (const client of clients.values()) {
    sendToClient(client.ws, msg, client.cipher);
  }
}
```

Envía la lista completa de clientes conectados a todos los peers. Se llama en cualquier evento que cambia el roster: nueva conexión (`hello`), desconexión, cambio de nombre (`rename`), cambio de disponibilidad (`set-receiving`).

---

## `broadcastFilesChanged`

```ts
export function broadcastFilesChanged(): void {
  const msg = { type: 'files-changed' };
  for (const client of clients.values()) {
    sendToClient(client.ws, msg, client.cipher);
  }
}
```

Notifica a todos los clientes que el directorio de archivos cambió (upload o delete). Lo llama `files.controller.ts` después de operaciones exitosas para que el frontend actualice su lista de archivos sin polling.
