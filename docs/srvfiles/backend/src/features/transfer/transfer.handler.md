# transfer.handler.ts

**Archivo:** `src/features/transfer/transfer.handler.ts`
**Rol:** Handler principal del WebSocket. Gestiona autenticación de conexiones, intercambio de claves E2E, señalización de transferencias P2P y relay de chunks binarios entre dispositivos.

---

## Concepto: relay WebSocket

En una red local típica los dispositivos no pueden conectarse directamente entre sí a nivel TCP. El relay actúa de intermediario: todos se conectan al servidor, y el servidor retransmite los mensajes entre ellos. El servidor no inspecciona el contenido de los archivos.

---

## `handleConnection`

Punto de entrada registrado en `index.ts`:
```ts
wss.on('connection', handleConnection);
```

### Inicialización por conexión

```ts
const clientId = crypto.randomUUID();
const rawIp = (req.socket.remoteAddress || '').replace('::ffff:', '');
const clientIp = (rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === '') ? getLanIp() : rawIp;
let client: ConnectedClient | null = null;
let authenticated = false;
const session = new WsSession();
```

Cada conexión recibe un UUID único. Las conexiones desde loopback (`127.0.0.1`, `::1`) reciben la IP LAN real para que otros dispositivos las vean correctamente en la lista de clientes.

---

## Flujo de mensajes

### 1. Autenticación (primer mensaje obligatorio)

```ts
if (!authenticated) {
  if (msg.type !== 'auth') { ws.close(4401, 'Unauthorized'); return; }
  if (!validateToken(String(msg.token ?? ''))) { ws.close(4401, 'Token inválido'); return; }
  authenticated = true;
  ws.send(JSON.stringify({ type: 'auth_ok' }));
  return;
}
```

El **primer** mensaje de cualquier conexión WebSocket debe ser `{ type: 'auth', token: string }`. Si no, la conexión se cierra con código `4401`. Esto protege el WebSocket con el mismo sistema de tokens que las rutas HTTP.

### 2. Intercambio de claves (opcional)

```ts
if (msg.type === 'key-exchange') {
  const serverPubKeyB64 = await session.handleKeyExchange(String(msg.publicKey ?? ''));
  if (client) client.cipher = session.cipher;
  ws.send(JSON.stringify({ type: 'key-exchange', publicKey: serverPubKeyB64 }));
}
```

Puede ocurrir en cualquier momento después de autenticarse. El cliente envía su clave pública ECDH P-256 en base64; el servidor devuelve la suya. Ambos derivan la misma clave AES-256-GCM. Desde ese momento, todos los mensajes JSON se envuelven en `{ type: 'encrypted', iv, data }`.

### 3. Mensajes de señalización

| Tipo | Acción |
|------|--------|
| `hello` | Registra el cliente con su nombre, tipo de dispositivo e `isServer`. Responde `welcome` con el `clientId`. |
| `set-receiving` | Actualiza `client.receiving`. Notifica a todos con `broadcastClients()`. |
| `rename` | Actualiza `client.appName`. Notifica a todos. |
| `send-request` | Verifica que el receptor esté online. Crea la `TransferSession`. Reenvía la solicitud al receptor. |
| `send-accept` | Valida que quien acepta es el receptor de esa sesión. Notifica al remitente para iniciar el envío. |
| `send-reject` | Notifica al remitente y limpia la sesión. |
| `send-cancel` | Puede iniciarlo cualquiera. Notifica al otro extremo y limpia la sesión. |
| `send-complete` | Solo el remitente puede enviarlo. Notifica al receptor y limpia la sesión. |

### 4. Mensajes binarios (chunks de archivo)

```ts
if (isBinary) {
  if (!authenticated) { ws.close(4401, 'Unauthorized'); return; }
  // Si hay cipher, descifra primero
  const transferId = payload.subarray(0, 36).toString('ascii').trim();
  const transferSess = getTransfer(transferId);
  const receiver = getClient(transferSess.receiverClientId);
  // Si el receptor tiene cipher, cifra para él antes de reenviar
  receiver.ws.send(payload, { binary: true });
}
```

Los primeros 36 bytes del buffer binario son el `transferId` (UUID ASCII). El servidor lo extrae para enrutar el chunk al receptor correcto sin inspeccionar el contenido.

Si el sender tiene cifrado activo, el chunk llega cifrado con su clave de sesión → el servidor lo descifra. Si el receptor tiene cifrado activo, el servidor lo vuelve a cifrar con la clave del receptor antes de reenviarlo. Esto permite que cada par de dispositivos tenga su propio canal E2E independiente.

---

## Protocolo completo de una transferencia

```
Remitente              Servidor relay              Receptor
    |                       |                          |
    |-- send-request -----→ |                          |
    |                       |-- send-request --------→ |
    |                       | ←------- send-accept --- |
    | ←--- send-accept ---- |                          |
    |-- [chunk binario] --→ |-- [chunk binario] -----→ |
    |         ...           |           ...            |
    |-- send-complete ----→ |-- send-complete -------→ |
```

---

## Evento `close`

```ts
ws.on('close', () => {
  if (client) {
    removeClient(clientId);
    broadcastClients();
  }
});
```

Al cerrar la conexión se elimina el cliente del registro y se notifica a todos. El `if (client)` protege el caso donde la conexión se cierra antes del mensaje `hello`.
