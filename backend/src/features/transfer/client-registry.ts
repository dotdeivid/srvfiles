import { WebSocket } from 'ws';
import type { ConnectedClient, TransferSession } from '../../domain/types';
import type { SessionCipher } from './session';

// ─── State ───────────────────────────────────────────────────────────

const clients = new Map<string, ConnectedClient>();
const transfers = new Map<string, TransferSession>();

// ─── Client management ──────────────────────────────────────────────

export function addClient(clientId: string, client: ConnectedClient): void {
  clients.set(clientId, client);
}

export function removeClient(clientId: string): void {
  clients.delete(clientId);
}

export function getClient(clientId: string): ConnectedClient | undefined {
  return clients.get(clientId);
}

// ─── Transfer session management ────────────────────────────────────

export function addTransfer(transferId: string, session: TransferSession): void {
  transfers.set(transferId, session);
}

export function getTransfer(transferId: string): TransferSession | undefined {
  return transfers.get(transferId);
}

export function removeTransfer(transferId: string): void {
  transfers.delete(transferId);
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Sends a JSON message to a WebSocket client, encrypting if the client has an active cipher.
 */
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

/**
 * Broadcasts the current client roster to every connected peer.
 */
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

/**
 * Broadcasts a `files-changed` event to all connected clients.
 */
export function broadcastFilesChanged(): void {
  const msg = { type: 'files-changed' };
  for (const client of clients.values()) {
    sendToClient(client.ws, msg, client.cipher);
  }
}
