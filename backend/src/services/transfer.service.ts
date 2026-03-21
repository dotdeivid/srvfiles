import { WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { getLanIp } from '../config';

// ─── Types ───────────────────────────────────────────────────────────

interface ConnectedClient {
  ws: WebSocket;
  clientId: string;
  appName: string;
  receiving: boolean;
  ip: string;
  deviceType: 'mobile' | 'desktop';
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

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastClients() {
  const list = Array.from(clients.values()).map((c) => ({
    clientId: c.clientId,
    appName: c.appName,
    receiving: c.receiving,
    ip: c.ip,
    deviceType: c.deviceType,
  }));
  const data = JSON.stringify({ type: 'clients', clients: list });
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

// ─── Connection handler ──────────────────────────────────────────────

export function handleConnection(ws: WebSocket, req: IncomingMessage) {
  const clientId = crypto.randomUUID();
  const rawIp = (req.socket.remoteAddress || '').replace('::ffff:', '');
  // When the desktop app connects from localhost, use the server's LAN IP instead of 127.0.0.1
  const clientIp = (rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === '') ? getLanIp() : rawIp;
  let client: ConnectedClient | null = null;

  ws.on('message', (data, isBinary) => {
    // ── Binary: relay file chunk to receiver ──
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

    // ── Text: JSON signaling ──
    let msg: any;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    switch (msg.type) {
      case 'hello': {
        client = { ws, clientId, appName: msg.appName || 'Unknown', receiving: false, ip: clientIp, deviceType: msg.deviceType === 'mobile' ? 'mobile' : 'desktop' };
        clients.set(clientId, client);
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
          send(ws, { type: 'send-reject', transferId, reason: 'offline' });
          return;
        }
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
        const sender = clients.get(session.senderClientId);
        if (sender) send(sender.ws, { type: 'send-accept', transferId: msg.transferId });
        break;
      }

      case 'send-reject': {
        if (!client) return;
        const session = transfers.get(msg.transferId);
        if (!session || session.receiverClientId !== clientId) return;
        const sender = clients.get(session.senderClientId);
        if (sender) send(sender.ws, { type: 'send-reject', transferId: msg.transferId });
        transfers.delete(msg.transferId);
        break;
      }

      case 'send-cancel': {
        if (!client) return;
        const session = transfers.get(msg.transferId);
        if (!session) return;
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
        const receiver = clients.get(session.receiverClientId);
        if (receiver) send(receiver.ws, { type: 'send-complete', transferId: msg.transferId });
        transfers.delete(msg.transferId);
        break;
      }
    }
  });

  ws.on('close', () => {
    if (client) {
      clients.delete(clientId);
      broadcastClients();
    }
  });
}
