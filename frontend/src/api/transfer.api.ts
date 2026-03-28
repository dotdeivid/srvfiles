import { getApiUrl } from './files.api';
import { log } from '../lib/logger';
import { isCryptoAvailable, generateEcdhKeyPair, exportPublicKey, deriveCipher, SessionCipher } from '../lib/crypto';

// ─── Types ───────────────────────────────────────────────────────────

export interface TransferClient {
  clientId: string;
  appName: string;
  receiving: boolean;
  ip: string;
  deviceType: 'mobile' | 'desktop';
  isServer: boolean;
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
  | { type: 'auth_ok' }
  | { type: 'encrypted'; iv: string; data: string }
  | { type: 'key-exchange'; publicKey: string }
  | { type: 'welcome'; clientId: string }
  | { type: 'clients'; clients: TransferClient[] }
  | { type: 'send-request'; from: string; fromName: string; fileName: string; fileSize: number; mimeType: string; transferId: string }
  | { type: 'send-accept'; transferId: string }
  | { type: 'send-reject'; transferId: string; reason?: string }
  | { type: 'send-cancel'; transferId: string }
  | { type: 'send-complete'; transferId: string }
  | { type: 'files-changed' };

// ─── Chunk size ──────────────────────────────────────────────────────
const CHUNK_SIZE = 256 * 1024;

// ─── TransferConnection ──────────────────────────────────────────────

export class TransferConnection {
  ws: WebSocket;
  private clientId: string | null = null;
  private handlers = new Map<string, (msg: any) => void>();
  private binaryHandlers: ((buf: ArrayBuffer) => void)[] = [];

  // ─── Encryption state ─────────────────────────────────────────────
  private _cipher: SessionCipher | null = null;
  private _keyExchangeResolve: ((pubKey: string) => void) | null = null;
  /** Serializes encrypted sends to preserve message ordering. */
  private _sendQueue: Promise<void> = Promise.resolve();

  constructor(serverUrl: string) {
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onmessage = async (event) => {
      // ── Binary frame ──
      if (event.data instanceof ArrayBuffer) {
        let buf: ArrayBuffer = event.data;
        if (this._cipher) {
          try {
            buf = (await this._cipher.decryptBinary(new Uint8Array(event.data))).buffer;
          } catch (err) {
            void log.warn('[TransferConnection] binary decryption failed', { error: String(err) });
            return;
          }
        }
        this.binaryHandlers.forEach((h) => h(buf));
        return;
      }

      // ── Text frame ──
      try {
        let msg = JSON.parse(event.data as string) as ServerMessage & { iv?: string; data?: string };

        // Decrypt if in encrypted mode
        if (this._cipher && msg.type === 'encrypted' && msg.iv && msg.data) {
          const plaintext = await this._cipher.decryptJson(msg.iv, msg.data);
          msg = JSON.parse(plaintext) as ServerMessage;
        }

        // Key-exchange response — resolve the pending key-exchange Promise
        if (msg.type === 'key-exchange') {
          this._keyExchangeResolve?.((msg as { type: 'key-exchange'; publicKey: string }).publicKey);
          this._keyExchangeResolve = null;
          return;
        }

        // auth_ok — perform key exchange before firing the external handler
        if (msg.type === 'auth_ok') {
          await this._doKeyExchange();
        }

        if (msg.type === 'welcome') this.clientId = msg.clientId;
        void log.debug(`[TransferConnection] message received: ${msg.type}`);
        this.handlers.get(msg.type)?.(msg);
      } catch (err) {
        void log.warn('[TransferConnection] malformed WS message ignored', { error: String(err) });
      }
    };
  }

  // ─── Key exchange ─────────────────────────────────────────────────

  private async _doKeyExchange(): Promise<void> {
    if (!isCryptoAvailable()) {
      void log.warn('[TransferConnection] crypto.subtle unavailable (HTTP context) — skipping key exchange');
      return;
    }
    try {
      const keyPair = await generateEcdhKeyPair();
      const pubKeyB64 = await exportPublicKey(keyPair.publicKey);
      // Send key-exchange in plaintext (cipher not set yet)
      this.ws.send(JSON.stringify({ type: 'key-exchange', publicKey: pubKeyB64 }));
      void log.debug('[TransferConnection] key-exchange sent, waiting for server response');

      const serverPubKeyB64 = await new Promise<string>((resolve) => {
        this._keyExchangeResolve = resolve;
      });

      this._cipher = await deriveCipher(keyPair.privateKey, serverPubKeyB64);
      void log.info('[TransferConnection] key exchange complete — encryption active');
    } catch (err) {
      void log.error('[TransferConnection] key exchange failed', { error: String(err) });
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

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

  // ─── Send helpers ─────────────────────────────────────────────────

  /** Sends raw JSON without encryption (used for auth and key-exchange). */
  private sendRaw(msg: object): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Sends JSON, encrypting if cipher is active. Preserves ordering via a send queue. */
  private sendJson(msg: object): void {
    if (this.ws.readyState !== WebSocket.OPEN) {
      void log.warn('[TransferConnection] sendJson: socket not open', { readyState: this.ws.readyState });
      return;
    }
    if (!this._cipher) {
      this.sendRaw(msg);
      return;
    }
    const cipher = this._cipher;
    const payload = JSON.stringify(msg);
    this._sendQueue = this._sendQueue.then(async () => {
      if (this.ws.readyState !== WebSocket.OPEN) return;
      const { iv, data } = await cipher.encryptJson(payload);
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'encrypted', iv, data }));
      }
    }).catch((err) => {
      void log.warn('[TransferConnection] sendJson encryption failed', { error: String(err) });
    });
  }

  // ─── Protocol methods ─────────────────────────────────────────────

  auth(token: string) { this.sendRaw({ type: 'auth', token }); }

  register(appName: string, isServer = false) {
    this.sendJson({ type: 'hello', appName, deviceType: 'desktop', isServer });
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
  rename(newName: string) { this.sendJson({ type: 'rename', newName }); }

  async sendFile(transferId: string, file: File, onProgress?: (pct: number) => void) {
    void log.info('[TransferConnection] sendFile started', { transferId, fileName: file.name, fileSize: file.size });
    const encoder = new TextEncoder();
    const idBytes = encoder.encode(transferId.padEnd(36, ' ').slice(0, 36));
    let offset = 0;
    while (offset < file.size) {
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const chunkBuf = await file.slice(offset, end).arrayBuffer();

      // Build payload: [36 bytes transferId][chunk data]
      const payload = new Uint8Array(36 + chunkBuf.byteLength);
      payload.set(idBytes, 0);
      payload.set(new Uint8Array(chunkBuf), 36);

      if (this._cipher) {
        const encrypted = await this._cipher.encryptBinary(payload);
        this.ws.send(encrypted.buffer);
      } else {
        this.ws.send(payload.buffer);
      }

      offset = end;
      onProgress?.(Math.round((offset / file.size) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }
    this.sendJson({ type: 'send-complete', transferId });
    void log.info('[TransferConnection] sendFile complete', { transferId });
  }

  close() { this.ws.close(); }
}

// ─── Helper ──────────────────────────────────────────────────────────

export function getTransferWsUrl(serverUrl?: string): string {
  return (serverUrl || getApiUrl()).replace(/^http/, 'ws') + '/ws';
}
