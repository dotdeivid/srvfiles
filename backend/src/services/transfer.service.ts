import { WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { getLanIp } from '../config';
import { validateToken } from '../middleware/auth';
import { log } from '../lib/logger';

// ─── Types ───────────────────────────────────────────────────────────

interface ConnectedClient {
  ws: WebSocket;
  clientId: string;
  appName: string;
  receiving: boolean;
  ip: string;
  deviceType: 'mobile' | 'desktop';
  isServer: boolean;
}

interface TransferSession {
  transferId: string;
  senderClientId: string;
  receiverClientId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// ─── State ───────────────────────────────────────────────────────────

const clients = new Map<string, ConnectedClient>();
const transfers = new Map<string, TransferSession>();

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Sends a JSON-serialized message to a single WebSocket client.
 * Silently drops the send if the socket is not in OPEN state.
 *
 * @param ws  - The target WebSocket connection.
 * @param msg - Any object; will be serialized with `JSON.stringify`.
 */
function send(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Broadcasts the current client roster to every connected peer.
 * Called after any state change that affects the visible client list:
 * new connection (`hello`), disconnection (`close`), receiving-mode
 * toggle (`set-receiving`), or a rename (`rename`).
 */
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

// ─── Files changed broadcast ─────────────────────────────────────────

/**
 * Broadcasts a `files-changed` event to all connected clients.
 * Called by file routes after upload/delete to keep all UIs in sync.
 */
export function broadcastFilesChanged() {
  const data = JSON.stringify({ type: 'files-changed' });
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

// ─── Connection handler ──────────────────────────────────────────────

/**
 * Entry point for every new WebSocket connection on `/ws`.
 * Registered directly with `wss.on('connection', handleConnection)`.
 *
 * Lifecycle:
 * 1. Assigns a UUID `clientId` and resolves the client's IP (maps loopback → LAN IP).
 * 2. Waits for a `hello` message to register the client in the in-memory registry.
 * 3. Routes subsequent JSON messages through a switch dispatcher:
 *    - `set-receiving` — toggles the client's availability for incoming transfers.
 *    - `rename`        — updates the client's display name without reconnecting.
 *    - `send-request`  — forwards a transfer request to the target peer; rejects if offline.
 *    - `send-accept`   — notifies the sender that the receiver accepted.
 *    - `send-reject`   — notifies the sender that the receiver rejected; cleans up the session.
 *    - `send-cancel`   — notifies the other party of cancellation; cleans up the session.
 *    - `send-complete` — notifies the receiver that all chunks have been sent; cleans up the session.
 * 4. Relays binary frames (file chunks) directly to the receiver identified by the
 *    36-byte `transferId` prefix embedded in each frame.
 * 5. On socket close, removes the client from the registry and re-broadcasts the roster.
 *
 * @param ws  - The newly opened WebSocket connection.
 * @param req - The underlying HTTP upgrade request, used to extract the client's IP.
 */
export function handleConnection(ws: WebSocket, req: IncomingMessage) {
  const clientId = crypto.randomUUID();
  const rawIp = (req.socket.remoteAddress || '').replace('::ffff:', '');
  // When the desktop app connects from localhost, use the server's LAN IP instead of 127.0.0.1
  const clientIp = (rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === '') ? getLanIp() : rawIp;
  log.debug('transfer.service.ts', 'New WS connection', { clientIp });
  let client: ConnectedClient | null = null;
  let authenticated = false;

  ws.on('message', (data, isBinary) => {
    // ── Binary: only allowed after authentication ──
    if (isBinary) {
      if (!authenticated) { ws.close(4401, 'Unauthorized'); return; }
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      const transferId = buf.subarray(0, 36).toString('ascii').trim();
      const session = transfers.get(transferId);
      if (!session) {
        log.warn('transfer.service.ts', 'Binary chunk received for unknown transferId', { transferId });
        return;
      }
      const receiver = clients.get(session.receiverClientId);
      if (receiver?.ws.readyState === WebSocket.OPEN) {
        receiver.ws.send(buf, { binary: true });
      }
      return;
    }

    // ── Text: JSON signaling ──
    let msg: any;
    try { msg = JSON.parse(data.toString()); } catch (err) {
      log.error('transfer.service.ts', 'Mensaje WS no es JSON válido', { error: String(err) });
      return;
    }

    // ── Auth: must be the first message ──
    // Client sends { type: "auth", token } (the token obtained via POST /api/auth).
    // Server validates the token and responds { type: "auth_ok" }.
    // Client then proceeds with the normal hello/welcome handshake.
    if (!authenticated) {
      if (msg.type !== 'auth') {
        log.warn('transfer.service.ts', 'First WS message was not auth', { type: msg.type, clientIp });
        ws.close(4401, 'Unauthorized');
        return;
      }
      if (!validateToken(String(msg.token ?? ''))) {
        log.warn('transfer.service.ts', 'WS auth failed — invalid token', { clientIp });
        ws.close(4401, 'Token inválido');
        return;
      }
      authenticated = true;
      log.debug('transfer.service.ts', 'WS client authenticated', { clientIp });
      send(ws, { type: 'auth_ok' });
      return;
    }

    switch (msg.type) {
      case 'hello': {
        client = { ws, clientId, appName: msg.appName || 'Unknown', receiving: false, ip: clientIp, deviceType: msg.deviceType === 'mobile' ? 'mobile' : 'desktop', isServer: msg.isServer === true };
        clients.set(clientId, client);
        log.info('transfer.service.ts', 'Client registered', { clientId, appName: client.appName, ip: clientIp, deviceType: client.deviceType, isServer: client.isServer });
        send(ws, { type: 'welcome', clientId });
        broadcastClients();
        break;
      }

      case 'set-receiving': {
        if (!client) return;
        client.receiving = !!msg.receiving;
        broadcastClients();
        break;
      }

      case 'rename': {
        if (!client) return;
        const newName = (msg.newName || '').trim();
        if (newName) {
          client.appName = newName;
          broadcastClients();
        }
        break;
      }

      case 'send-request': {
        if (!client) return;
        const { to, fileName, fileSize, mimeType, transferId } = msg;
        const receiver = clients.get(to);
        if (!receiver || receiver.ws.readyState !== WebSocket.OPEN) {
          log.warn('transfer.service.ts', 'Transfer target offline', { transferId, to, fileName });
          send(ws, { type: 'send-reject', transferId, reason: 'offline' });
          return;
        }
        log.info('transfer.service.ts', 'Transfer request relayed', { transferId, from: client.appName, to: receiver.appName, fileName, fileSize });
        transfers.set(transferId, {
          transferId,
          senderClientId: clientId,
          receiverClientId: to,
          fileName,
          fileSize,
          mimeType,
        });
        send(receiver.ws, {
          type: 'send-request',
          from: clientId,
          fromName: client.appName,
          fileName,
          fileSize,
          mimeType,
          transferId,
        });
        break;
      }

      case 'send-accept': {
        if (!client) return;
        const session = transfers.get(msg.transferId);
        if (!session || session.receiverClientId !== clientId) return;
        log.info('transfer.service.ts', 'Transfer accepted', { transferId: msg.transferId, receiver: client.appName });
        const sender = clients.get(session.senderClientId);
        if (sender) send(sender.ws, { type: 'send-accept', transferId: msg.transferId });
        break;
      }

      case 'send-reject': {
        if (!client) return;
        const session = transfers.get(msg.transferId);
        if (!session || session.receiverClientId !== clientId) return;
        log.info('transfer.service.ts', 'Transfer rejected', { transferId: msg.transferId, receiver: client.appName });
        const sender = clients.get(session.senderClientId);
        if (sender) send(sender.ws, { type: 'send-reject', transferId: msg.transferId });
        transfers.delete(msg.transferId);
        break;
      }

      case 'send-cancel': {
        if (!client) return;
        const session = transfers.get(msg.transferId);
        if (!session) return;
        log.info('transfer.service.ts', 'Transfer cancelled', { transferId: msg.transferId, by: client.appName });
        // Notify the other party
        const otherId = session.senderClientId === clientId
          ? session.receiverClientId
          : session.senderClientId;
        const other = clients.get(otherId);
        if (other) send(other.ws, { type: 'send-cancel', transferId: msg.transferId });
        transfers.delete(msg.transferId);
        break;
      }

      case 'send-complete': {
        if (!client) return;
        const session = transfers.get(msg.transferId);
        if (!session || session.senderClientId !== clientId) return;
        log.info('transfer.service.ts', 'Transfer complete', { transferId: msg.transferId, fileName: session.fileName, fileSize: session.fileSize });
        const receiver = clients.get(session.receiverClientId);
        if (receiver) send(receiver.ws, { type: 'send-complete', transferId: msg.transferId });
        transfers.delete(msg.transferId);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (client) {
      log.info('transfer.service.ts', 'Client disconnected', { clientId, appName: client.appName });
      clients.delete(clientId);
      broadcastClients();
    } else {
      log.debug('transfer.service.ts', 'Unauthenticated WS connection closed', { clientIp });
    }
  });
}
