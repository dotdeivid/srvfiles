# services/transfer.service.ts

**Archivo:** `src/services/transfer.service.ts`
**Rol:** Servidor relay WebSocket para transferencias directas P2P entre dispositivos. Gestiona conexiones, estado de clientes, sesiones de transferencia, y retransmisión de chunks binarios.

---

## Concepto: ¿Qué es un relay?

En una transferencia P2P "pura", los archivos van directamente de un dispositivo a otro. Pero en una red local típica, los dispositivos no pueden conectarse directamente entre sí a nivel TCP (firewalls, NAT, etc.). El relay actúa de intermediario: todos los dispositivos se conectan al servidor, y el servidor retransmite los mensajes entre ellos.

---

## Tipos internos

### `ConnectedClient`

```ts
interface ConnectedClient {
  ws: WebSocket;        // La conexión WebSocket activa
  clientId: string;     // UUID único asignado al conectar
  appName: string;      // Nombre del dispositivo
  receiving: boolean;   // ¿Disponible para recibir?
  ip: string;           // IP del dispositivo
  deviceType: 'mobile' | 'desktop';
  isServer: boolean;    // ¿Es una instancia Tauri?
}
```

### `TransferSession`

```ts
interface TransferSession {
  transferId: string;
  senderClientId: string;    // Quién envía
  receiverClientId: string;  // Quién recibe
  fileName: string;
  fileSize: number;
  mimeType: string;
}
```

---

## Estado global en módulo

```ts
const clients = new Map<string, ConnectedClient>();
const transfers = new Map<string, TransferSession>();
```

Dos `Map` en memoria que persisten mientras el proceso está corriendo:
- `clients`: todos los dispositivos conectados actualmente, indexados por `clientId`.
- `transfers`: sesiones de transferencia activas, indexadas por `transferId`.

**¿Por qué no una base de datos?** Las transferencias son efímeras (duran segundos o minutos) y no necesitan persistencia entre reinicios del servidor. La memoria es más rápida para operaciones frecuentes de lectura/escritura.

---

## Función `send`

```ts
function send(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
```

Envía un mensaje JSON a un WebSocket específico, solo si la conexión está abierta. `readyState === WebSocket.OPEN` evita errores al intentar enviar en una conexión cerrada o en proceso de cierre.

---

## Función `broadcastClients`

```ts
function broadcastClients() {
  const list = Array.from(clients.values()).map((c) => ({
    clientId: c.clientId,
    appName: c.appName,
    receiving: c.receiving,
    ip: c.ip,
    deviceType: c.deviceType,
    isServer: c.isServer,
  }));
  const data = JSON.stringify({ type: 'clients', clients: list });
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}
```

Envía la lista completa de clientes conectados a **todos** los clientes. Se serializa una sola vez (`JSON.stringify` fuera del loop) por eficiencia.

Se llama en cualquier evento que cambia la lista visible: nueva conexión, desconexión, cambio de nombre, cambio de disponibilidad.

---

## Función `handleConnection`

Punto de entrada para cada nueva conexión WebSocket. Registrada en `index.ts`:
```ts
wss.on('connection', handleConnection);
```

### Inicialización

```ts
const clientId = crypto.randomUUID();
const rawIp = (req.socket.remoteAddress || '').replace('::ffff:', '');
const clientIp = (rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === '') ? getLanIp() : rawIp;
let client: ConnectedClient | null = null;
```

- **UUID**: identificador único para esta conexión.
- **`::ffff:`**: prefijo IPv4-mapped en IPv6. Se elimina para obtener la IP pura (ej: `::ffff:192.168.1.5` → `192.168.1.5`).
- **Mapeo de loopback**: si la conexión viene de `127.0.0.1` o `::1` (localhost), es la app Tauri conectándose desde la misma máquina. Se le asigna la IP LAN real para que otros dispositivos la vean correctamente.
- **`client = null`**: hasta que llegue el mensaje `hello`, este cliente no está registrado.

---

## Manejador de mensajes

### Mensajes binarios (chunks de archivo)

```ts
if (isBinary) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
  const transferId = buf.subarray(0, 36).toString('ascii').trim();
  const session = transfers.get(transferId);
  if (!session) return;
  const receiver = clients.get(session.receiverClientId);
  if (receiver?.ws.readyState === WebSocket.OPEN) {
    receiver.ws.send(buf, { binary: true });
  }
  return;
}
```

El relay de chunks es mínimo y rápido: leer los 36 bytes del `transferId`, encontrar al receptor en el `Map`, y reenviar el buffer completo. El servidor **no** inspecciona el contenido del archivo.

### `case 'hello'`

```ts
client = { ws, clientId, appName: msg.appName || 'Unknown', receiving: false, ip: clientIp,
           deviceType: msg.deviceType === 'mobile' ? 'mobile' : 'desktop',
           isServer: msg.isServer === true };
clients.set(clientId, client);
send(ws, { type: 'welcome', clientId });
broadcastClients();
```

Registra el cliente, le envía su `clientId`, y notifica a todos.

### `case 'set-receiving'`

```ts
client.receiving = !!msg.receiving;
broadcastClients();
```

`!!msg.receiving` convierte el valor a booleano estricto. Actualiza la disponibilidad y notifica a todos.

### `case 'rename'`

```ts
const newName = (msg.newName || '').trim();
if (newName) {
  client.appName = newName;
  broadcastClients();
}
```

Solo actualiza si el nuevo nombre no está vacío después de hacer trim.

### `case 'send-request'`

```ts
const receiver = clients.get(to);
if (!receiver || receiver.ws.readyState !== WebSocket.OPEN) {
  send(ws, { type: 'send-reject', transferId, reason: 'offline' });
  return;
}
transfers.set(transferId, { transferId, senderClientId: clientId, receiverClientId: to, ... });
send(receiver.ws, { type: 'send-request', from: clientId, fromName: client.appName, ... });
```

Verifica que el receptor exista y esté online. Si no, responde al remitente con un rechazo. Si sí, crea la sesión y reenvía la solicitud al receptor.

### `case 'send-accept'`

```ts
const session = transfers.get(msg.transferId);
if (!session || session.receiverClientId !== clientId) return;
const sender = clients.get(session.senderClientId);
if (sender) send(sender.ws, { type: 'send-accept', transferId: msg.transferId });
```

Valida que quien acepta es efectivamente el receptor de esa sesión. Notifica al remitente para que empiece a enviar chunks.

### `case 'send-reject'`

```ts
const session = transfers.get(msg.transferId);
if (!session || session.receiverClientId !== clientId) return;
const sender = clients.get(session.senderClientId);
if (sender) send(sender.ws, { type: 'send-reject', transferId: msg.transferId });
transfers.delete(msg.transferId);
```

Notifica al remitente y **limpia la sesión** del `Map`. Sin esto, las sesiones rechazadas quedarían en memoria indefinidamente.

### `case 'send-cancel'`

```ts
const otherId = session.senderClientId === clientId
  ? session.receiverClientId
  : session.senderClientId;
const other = clients.get(otherId);
if (other) send(other.ws, { type: 'send-cancel', transferId: msg.transferId });
transfers.delete(msg.transferId);
```

Puede ser iniciado por cualquiera de los dos (remitente o receptor). Determina quién es "el otro" y le notifica. Luego limpia la sesión.

### `case 'send-complete'`

```ts
const session = transfers.get(msg.transferId);
if (!session || session.senderClientId !== clientId) return;
const receiver = clients.get(session.receiverClientId);
if (receiver) send(receiver.ws, { type: 'send-complete', transferId: msg.transferId });
transfers.delete(msg.transferId);
```

Solo el **remitente** puede marcar una transferencia como completa. Notifica al receptor para que ensamble el blob, y limpia la sesión.

---

## Evento `close`

```ts
ws.on('close', () => {
  if (client) {
    clients.delete(clientId);
    broadcastClients();
  }
});
```

Cuando el WebSocket se cierra (el usuario cierra la pestaña, la app, o pierde conexión), se elimina al cliente del registro y se actualiza a todos. El `if (client)` protege el caso donde la conexión se cierra antes del `hello`.

---

## Protocolo completo de una transferencia

```
Remitente              Servidor relay              Receptor
    |                       |                          |
    |-- send-request -----→ |                          |
    |                       |-- send-request --------→ |
    |                       |                          |
    |                       | ←------- send-accept --- |
    | ←--- send-accept ---- |                          |
    |                       |                          |
    |-- [chunk binario] --→ |                          |
    |                       |-- [chunk binario] -----→ |
    |-- [chunk binario] --→ |                          |
    |                       |-- [chunk binario] -----→ |
    |         ...           |           ...            |
    |                       |                          |
    |-- send-complete ----→ |                          |
    |                       |-- send-complete -------→ |
```

---

## Cifrado E2E por sesión (ECDH P-256 + AES-256-GCM)

El relay también facilita el intercambio de claves para cifrado de extremo a extremo. El servidor **no** puede descifrar el contenido — solo retransmite.

```
Cliente                       Backend (ws/session.ts)
    |                                   |
    |-- key-exchange (pubKeyB64) -----→ |  [genera par ECDH efímero]
    |                                   |  [deriva AES-256-GCM vía HKDF]
    | ←-- key-exchange (serverPubKey) --|
    |  [cliente deriva misma clave]     |
    |                                   |
    |  ← canal AES-256-GCM activo →     |
```

Cada chunk cifrado llega como `{ type: 'encrypted', iv: string, data: string }` (base64). La sesión en `ws/session.ts` maneja el estado de la clave derivada. Si el cliente no soporta `crypto.subtle` (HTTP sin HTTPS), el cifrado no se activa y la transferencia ocurre en texto plano a través del relay.
