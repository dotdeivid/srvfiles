import { getApiUrl } from './files.api';

// ─── Types ───────────────────────────────────────────────────────────

export interface TransferClient {
  clientId: string;
  appName: string;
  receiving: boolean;
  ip: string;
}

export interface IncomingTransferRequest {
  transferId: string;
  from: string;
  fromName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

type ServerMessage =
  | { type: 'welcome'; clientId: string }
  | { type: 'clients'; clients: TransferClient[] }
  | { type: 'send-request'; from: string; fromName: string; fileName: string; fileSize: number; mimeType: string; transferId: string }
  | { type: 'send-accept'; transferId: string }
  | { type: 'send-reject'; transferId: string; reason?: string }
  | { type: 'send-cancel'; transferId: string }
  | { type: 'send-complete'; transferId: string };

// ─── Chunk size ──────────────────────────────────────────────────────
// 256KB per chunk — balanced for LAN speeds without memory bloat
const CHUNK_SIZE = 256 * 1024;

// ─── TransferConnection ──────────────────────────────────────────────

export class TransferConnection {
  ws: WebSocket;
  private clientId: string | null = null;
  private handlers = new Map<string, (msg: any) => void>();
  private binaryHandlers: ((buf: ArrayBuffer) => void)[] = [];

  constructor(serverUrl: string) {
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.binaryHandlers.forEach((h) => h(event.data as ArrayBuffer));
        return;
      }
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === 'welcome') this.clientId = msg.clientId;
        this.handlers.get(msg.type)?.(msg);
      } catch {
        // ignore malformed messages
      }
    };
  }

  getClientId() { return this.clientId; }

  on<T extends ServerMessage['type']>(
    type: T,
    handler: (msg: Extract<ServerMessage, { type: T }>) => void
  ) {
    this.handlers.set(type, handler as any);
    return this;
  }

  onBinary(handler: (buf: ArrayBuffer) => void) {
    this.binaryHandlers.push(handler);
    return this;
  }

  private sendJson(msg: object) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  register(appName: string) {
    this.sendJson({ type: 'hello', appName });
  }

  setReceiving(receiving: boolean) {
    this.sendJson({ type: 'set-receiving', receiving });
  }

  sendRequest(to: string, file: File, transferId: string) {
    this.sendJson({
      type: 'send-request',
      to,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      transferId,
    });
  }

  accept(transferId: string) { this.sendJson({ type: 'send-accept', transferId }); }
  reject(transferId: string) { this.sendJson({ type: 'send-reject', transferId }); }
  cancel(transferId: string) { this.sendJson({ type: 'send-cancel', transferId }); }
  rename(newName: string)    { this.sendJson({ type: 'rename', newName }); }

  async sendFile(transferId: string, file: File, onProgress?: (pct: number) => void) {
    const encoder = new TextEncoder();
    const idBytes = encoder.encode(transferId.padEnd(36, ' ').slice(0, 36));
    let offset = 0;
    while (offset < file.size) {
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const chunkBuf = await file.slice(offset, end).arrayBuffer();
      const frame = new Uint8Array(36 + chunkBuf.byteLength);
      frame.set(idBytes, 0);
      frame.set(new Uint8Array(chunkBuf), 36);
      this.ws.send(frame.buffer);
      offset = end;
      onProgress?.(Math.round((offset / file.size) * 100));
      // Yield to event loop to avoid blocking UI between chunks
      await new Promise((r) => setTimeout(r, 0));
    }
    this.sendJson({ type: 'send-complete', transferId });
  }

  close() { this.ws.close(); }
}

// ─── Helper to build WS URL from any server URL ──────────────────────
export function getTransferWsUrl(serverUrl?: string): string {
  return (serverUrl || getApiUrl()).replace(/^http/, 'ws') + '/ws';
}
