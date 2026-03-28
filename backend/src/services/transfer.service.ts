import { WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { getLanIp } from '../config';
import { validateToken } from '../middleware/auth';
import { log } from '../lib/logger';
import { WsSession, SessionCipher } from '../ws/session';

// ─── Types ───────────────────────────────────────────────────────────

interface ConnectedClient {
  ws: WebSocket;
  clientId: string;
  appName: string;
  receiving: boolean;
  ip: string;
  deviceType: 'mobile' | 'desktop';
  isServer: boolean;
  cipher: SessionCipher | null;
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
 * Sends a JSON message to a WebSocket client, encrypting if the client has an active cipher.
 * Uses fire-and-forget for async encryption — messages for the same client are ordered
 * because crypto.subtle resolves operations sequentially for a given key.
 */
function sendToClient(ws: WebSocket, msg: object, cipher: SessionCipher | null): void {
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

/**
 * Broadcasts the current client roster to every connected peer.
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
  const msg = { type: 'clients', clients: list };
  for (const client of clients.values()) {
    sendToClient(client.ws, msg, client.cipher);
  }
}

// ─── Files changed broadcast ─────────────────────────────────────────

/**
 * Broadcasts a `files-changed` event to all connected clients.
 */
export function broadcastFilesChanged() {
  const msg = { type: 'files-changed' };
  for (const client of clients.values()) {
    sendToClient(client.ws, msg, client.cipher);
  }
}

// ─── Connection handler ──────────────────────────────────────────────

export function handleConnection(ws: WebSocket, req: IncomingMessage) {
  const clientId = crypto.randomUUID();
  const rawIp = (req.socket.remoteAddress || '').replace('::ffff:', '');
  const clientIp = (rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === '') ? getLanIp() : rawIp;
  log.debug('transfer.service.ts', 'New WS connection', { clientIp });

  let client: ConnectedClient | null = null;
  let authenticated = false;
  const session = new WsSession();

  ws.on('message', async (data, isBinary) => {
    // ── Binary: decrypt if encrypted, then relay to receiver ──
    if (isBinary) {
      if (!authenticated) { ws.close(4401, 'Unauthorized'); return; }
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

      let payload: Buffer;
      if (session.cipher) {
        try {
          payload = await session.cipher.decryptBinary(buf);
        } catch (err) {
          log.warn('transfer.service.ts', 'Binary decryption failed', { error: String(err) });
          return;
        }
      } else {
        payload = buf;
      }

      const transferId = payload.subarray(0, 36).toString('ascii').trim();
      const transferSess = transfers.get(transferId);
      if (!transferSess) {
        log.warn('transfer.service.ts', 'Binary chunk received for unknown transferId', { transferId });
        return;
      }
      const receiver = clients.get(transferSess.receiverClientId);
      if (!receiver || receiver.ws.readyState !== WebSocket.OPEN) return;

      if (receiver.cipher) {
        void receiver.cipher.encryptBinary(payload).then((encrypted) => {
          if (receiver.ws.readyState === WebSocket.OPEN) {
            receiver.ws.send(encrypted, { binary: true });
          }
        });
      } else {
        receiver.ws.send(payload, { binary: true });
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
      ws.send(JSON.stringify({ type: 'auth_ok' }));
      return;
    }

    // ── Decrypt if encrypted mode ──
    if (session.cipher && msg.type === 'encrypted') {
      try {
        const plaintext = await session.cipher.decryptJson(msg.iv as string, msg.data as string);
        msg = JSON.parse(plaintext);
      } catch (err) {
        log.warn('transfer.service.ts', 'JSON decryption failed', { error: String(err) });
        return;
      }
    }

    // ── Key exchange ──
    if (msg.type === 'key-exchange') {
      try {
        const serverPubKeyB64 = await session.handleKeyExchange(String(msg.publicKey ?? ''));
        // Store cipher on the client record if already registered
        if (client) client.cipher = session.cipher;
        log.debug('transfer.service.ts', 'Key exchange complete — encryption active', { clientIp });
        ws.send(JSON.stringify({ type: 'key-exchange', publicKey: serverPubKeyB64 }));
      } catch (err) {
        log.error('transfer.service.ts', 'Key exchange failed', { error: String(err) });
      }
      return;
    }

    switch (msg.type) {
      case 'hello': {
        client = {
          ws,
          clientId,
          appName: msg.appName || 'Unknown',
          receiving: false,
          ip: clientIp,
          deviceType: msg.deviceType === 'mobile' ? 'mobile' : 'desktop',
          isServer: msg.isServer === true,
          cipher: session.cipher,  // may be null if no key exchange yet
        };
        clients.set(clientId, client);
        log.info('transfer.service.ts', 'Client registered', { clientId, appName: client.appName, ip: clientIp, deviceType: client.deviceType, isServer: client.isServer, encrypted: !!client.cipher });
        sendToClient(ws, { type: 'welcome', clientId }, session.cipher);
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
          sendToClient(ws, { type: 'send-reject', transferId, reason: 'offline' }, session.cipher);
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
        sendToClient(receiver.ws, {
          type: 'send-request',
          from: clientId,
          fromName: client.appName,
          fileName,
          fileSize,
          mimeType,
          transferId,
        }, receiver.cipher);
        break;
      }

      case 'send-accept': {
        if (!client) return;
        const transferSess = transfers.get(msg.transferId);
        if (!transferSess || transferSess.receiverClientId !== clientId) return;
        log.info('transfer.service.ts', 'Transfer accepted', { transferId: msg.transferId, receiver: client.appName });
        const sender = clients.get(transferSess.senderClientId);
        if (sender) sendToClient(sender.ws, { type: 'send-accept', transferId: msg.transferId }, sender.cipher);
        break;
      }

      case 'send-reject': {
        if (!client) return;
        const transferSess = transfers.get(msg.transferId);
        if (!transferSess || transferSess.receiverClientId !== clientId) return;
        log.info('transfer.service.ts', 'Transfer rejected', { transferId: msg.transferId, receiver: client.appName });
        const sender = clients.get(transferSess.senderClientId);
        if (sender) sendToClient(sender.ws, { type: 'send-reject', transferId: msg.transferId }, sender.cipher);
        transfers.delete(msg.transferId);
        break;
      }

      case 'send-cancel': {
        if (!client) return;
        const transferSess = transfers.get(msg.transferId);
        if (!transferSess) return;
        log.info('transfer.service.ts', 'Transfer cancelled', { transferId: msg.transferId, by: client.appName });
        const otherId = transferSess.senderClientId === clientId
          ? transferSess.receiverClientId
          : transferSess.senderClientId;
        const other = clients.get(otherId);
        if (other) sendToClient(other.ws, { type: 'send-cancel', transferId: msg.transferId }, other.cipher);
        transfers.delete(msg.transferId);
        break;
      }

      case 'send-complete': {
        if (!client) return;
        const transferSess = transfers.get(msg.transferId);
        if (!transferSess || transferSess.senderClientId !== clientId) return;
        log.info('transfer.service.ts', 'Transfer complete', { transferId: msg.transferId, fileName: transferSess.fileName, fileSize: transferSess.fileSize });
        const receiver = clients.get(transferSess.receiverClientId);
        if (receiver) sendToClient(receiver.ws, { type: 'send-complete', transferId: msg.transferId }, receiver.cipher);
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
