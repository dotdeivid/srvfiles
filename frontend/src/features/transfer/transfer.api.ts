import { log } from '../../lib/logger';
import { isCryptoAvailable, generateEcdhKeyPair, exportPublicKey, deriveCipher, SessionCipher } from '../../lib/crypto';
import type { E2ESession } from '../../lib/e2e';

// ─── Types ───────────────────────────────────────────────────────────

export interface TransferClient {
  clientId: string;
  appName: string;
  receiving: boolean;
  ip: string;
  deviceType: 'mobile' | 'desktop';
  isServer: boolean;
  /** Puerto HTTP del servidor SrvFiles de ese equipo (si es un servidor). */
  serverPort?: number;
  /** Soporta cifrado de extremo a extremo (obligatorio para transferir). */
  e2e?: boolean;
}

export interface IncomingTransferRequest {
  transferId: string;
  from: string;
  fromName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** Clave pública E2E del emisor. */
  senderPublicKey: string;
}

type ServerMessage =
  | { type: 'auth_ok' }
  | { type: 'encrypted'; iv: string; data: string }
  | { type: 'key-exchange'; publicKey: string }
  | { type: 'key-exchange-error'; reason?: string }
  | { type: 'welcome'; clientId: string }
  | { type: 'clients'; clients: TransferClient[] }
  | { type: 'send-request'; from: string; fromName: string; fileName: string; fileSize: number; mimeType: string; transferId: string; e2e?: { publicKey?: string } }
  | { type: 'send-key'; transferId: string; publicKey: string }
  | { type: 'send-accept'; transferId: string }
  | { type: 'send-reject'; transferId: string; reason?: string }
  | { type: 'send-cancel'; transferId: string }
  | { type: 'send-complete'; transferId: string; e2e?: { final?: string } }
  | { type: 'files-changed' };

type MessageType = ServerMessage['type'];

// ─── Constants ───────────────────────────────────────────────────────
const CHUNK_SIZE = 256 * 1024;
const TRANSFER_ID_LENGTH = 36;
const KEY_EXCHANGE_TIMEOUT_MS = 5_000;
/** Por encima de esto se espera a que el socket vacíe su buffer (contrapresión). */
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

/** Se lanza desde sendFile cuando se cancela o se cierra la conexión. */
export class TransferAbortedError extends Error {
  constructor(readonly reason: 'cancelled' | 'disconnected') {
    super(reason);
    this.name = 'TransferAbortedError';
  }
}

/** Token de cancelación para un envío. */
export class CancelToken {
  cancelled = false;
  cancel() { this.cancelled = true; }
}

// ─── TransferConnection ──────────────────────────────────────────────

/**
 * Una conexión WebSocket al relay (servidor SrvFiles o teléfono).
 *
 * - Los mensajes entrantes se procesan en orden: con cifrado, descifrar es
 *   asíncrono y sin cola un `send-complete` podía adelantarse a los últimos
 *   chunks (archivo truncado o desordenado).
 * - El intercambio de claves tiene timeout: si el servidor no responde se
 *   sigue sin cifrar en lugar de quedar colgado sin registrarse.
 * - El envío respeta `bufferedAmount` para no encolar el archivo entero.
 */
export class TransferConnection {
  readonly ws: WebSocket;
  private clientId: string | null = null;
  private handlers = new Map<string, (msg: never) => void>();
  private binaryHandlers: ((buf: ArrayBuffer) => void)[] = [];

  private _cipher: SessionCipher | null = null;
  private _sessionStarted = false;
  private _keyExchangeResolve: ((pubKey: string | null) => void) | null = null;
  /** Serializa los envíos cifrados para preservar el orden. */
  private _sendQueue: Promise<void> = Promise.resolve();
  /** Serializa el procesamiento de mensajes entrantes. */
  private _receiveQueue: Promise<void> = Promise.resolve();

  /** Se llama tras auth_ok y el intercambio de claves (con o sin cifrado). */
  onReady?: (encrypted: boolean) => void;

  constructor(serverUrl: string) {
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws';
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';
    this.ws.addEventListener('message', (event) => {
      this._receiveQueue = this._receiveQueue
        .then(() => this.handleMessage(event))
        .catch((err) => void log.warn('[TransferConnection] message handling failed', { error: String(err) }));
    });
  }

  get encrypted(): boolean {
    return this._cipher !== null;
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    // ── Binary frame ──
    if (event.data instanceof ArrayBuffer) {
      let buf: ArrayBuffer = event.data;
      if (this._cipher) {
        try {
          const plain = await this._cipher.decryptBinary(new Uint8Array(event.data));
          buf = plain.buffer.slice(plain.byteOffset, plain.byteOffset + plain.byteLength) as ArrayBuffer;
        } catch (err) {
          void log.warn('[TransferConnection] binary decryption failed', { error: String(err) });
          return;
        }
      }
      this.binaryHandlers.forEach((h) => h(buf));
      return;
    }

    // ── Text frame ──
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data as string) as ServerMessage;
    } catch {
      void log.warn('[TransferConnection] malformed WS message ignored');
      return;
    }

    if (this._cipher) {
      if (msg.type !== 'encrypted') {
        void log.warn('[TransferConnection] plaintext message dropped on encrypted session', { type: msg.type });
        return;
      }
      const plaintext = await this._cipher.decryptJson(msg.iv, msg.data);
      msg = JSON.parse(plaintext) as ServerMessage;
    }

    switch (msg.type) {
      case 'key-exchange':
        this._keyExchangeResolve?.(msg.publicKey);
        this._keyExchangeResolve = null;
        return;
      case 'key-exchange-error':
        this._keyExchangeResolve?.(null);
        this._keyExchangeResolve = null;
        return;
      case 'auth_ok':
        if (this._sessionStarted) return; // auth_ok duplicado
        this._sessionStarted = true;
        // No se espera dentro de la cola: la respuesta del key-exchange llega
        // por esta misma cola y esperarla aquí la bloquearía.
        void this.startSession();
        return;
      case 'welcome':
        this.clientId = msg.clientId;
        break;
    }
    void log.debug(`[TransferConnection] message received: ${msg.type}`);
    (this.handlers.get(msg.type) as ((m: ServerMessage) => void) | undefined)?.(msg);
  }

  // ─── Key exchange ─────────────────────────────────────────────────

  private async startSession(): Promise<void> {
    await this.doKeyExchange();
    this.onReady?.(this._cipher !== null);
  }

  private async doKeyExchange(): Promise<void> {
    if (!isCryptoAvailable()) {
      void log.warn('[TransferConnection] crypto.subtle unavailable (HTTP context) — session not encrypted');
      return;
    }
    try {
      const keyPair = await generateEcdhKeyPair();
      const pubKeyB64 = await exportPublicKey(keyPair.publicKey);
      const response = new Promise<string | null>((resolve) => {
        this._keyExchangeResolve = resolve;
        setTimeout(() => resolve(null), KEY_EXCHANGE_TIMEOUT_MS);
      });
      this.sendRaw({ type: 'key-exchange', publicKey: pubKeyB64 });
      const serverPubKeyB64 = await response;
      this._keyExchangeResolve = null;
      if (!serverPubKeyB64) {
        void log.warn('[TransferConnection] key exchange failed or timed out — session not encrypted');
        return;
      }
      this._cipher = await deriveCipher(keyPair.privateKey, serverPubKeyB64);
      void log.info('[TransferConnection] key exchange complete — encryption active');
    } catch (err) {
      void log.error('[TransferConnection] key exchange failed', { error: String(err) });
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  getClientId() { return this.clientId; }

  on<T extends MessageType>(type: T, handler: (msg: Extract<ServerMessage, { type: T }>) => void) {
    this.handlers.set(type, handler as (msg: never) => void);
    return this;
  }

  onBinary(handler: (buf: ArrayBuffer) => void) {
    this.binaryHandlers.push(handler);
    return this;
  }

  // ─── Send helpers ─────────────────────────────────────────────────

  private get open(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  /** Sends raw JSON without encryption (auth and key-exchange only). */
  private sendRaw(msg: object): void {
    if (this.open) this.ws.send(JSON.stringify(msg));
  }

  /** Sends JSON, encrypting if the cipher is active. Preserves ordering. */
  private sendJson(msg: object): void {
    const cipher = this._cipher;
    const payload = JSON.stringify(msg);
    this._sendQueue = this._sendQueue.then(async () => {
      if (!this.open) return;
      if (!cipher) {
        this.ws.send(payload);
        return;
      }
      const { iv, data } = await cipher.encryptJson(payload);
      if (this.open) this.ws.send(JSON.stringify({ type: 'encrypted', iv, data }));
    }).catch((err) => {
      void log.warn('[TransferConnection] sendJson failed', { error: String(err) });
    });
  }

  // ─── Protocol methods ─────────────────────────────────────────────

  auth(token: string) { this.sendRaw({ type: 'auth', token }); }

  register(appName: string, isServer = false, serverPort?: number) {
    // e2e: 1 → este cliente cifra de extremo a extremo (protocolo v2).
    this.sendJson({ type: 'hello', appName, deviceType: 'desktop', isServer, serverPort, e2e: 1 });
  }

  setReceiving(receiving: boolean) { this.sendJson({ type: 'set-receiving', receiving }); }

  sendRequest(to: string, file: File, transferId: string, e2ePublicKey: string) {
    this.sendJson({
      type: 'send-request',
      to,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      transferId,
      e2e: { publicKey: e2ePublicKey },
    });
  }

  /** Receptor → emisor: clave pública E2E del receptor. */
  sendKey(transferId: string, publicKey: string) { this.sendJson({ type: 'send-key', transferId, publicKey }); }

  accept(transferId: string) { this.sendJson({ type: 'send-accept', transferId }); }
  reject(transferId: string, reason?: string) { this.sendJson({ type: 'send-reject', transferId, reason }); }
  cancel(transferId: string) { this.sendJson({ type: 'send-cancel', transferId }); }
  rename(newName: string) { this.sendJson({ type: 'rename', newName }); }

  /**
   * Envía el archivo en chunks de 256 KB, cada uno cifrado de extremo a
   * extremo con su índice. Lee del File de a un chunk y espera cuando el
   * socket tiene más de 4 MB pendientes. Al final manda send-complete con el
   * marcador final cifrado. Lanza TransferAbortedError si se cancela o se
   * cierra la conexión (y entonces no manda send-complete).
   */
  async sendFile(transferId: string, file: File, e2e: E2ESession, onProgress?: (pct: number) => void, cancel?: CancelToken) {
    void log.info('[TransferConnection] sendFile started', { transferId, fileSize: file.size });
    const idBytes = new TextEncoder().encode(transferId.padEnd(TRANSFER_ID_LENGTH, ' ').slice(0, TRANSFER_ID_LENGTH));
    const check = () => {
      if (cancel?.cancelled) throw new TransferAbortedError('cancelled');
      if (!this.open) throw new TransferAbortedError('disconnected');
    };

    let offset = 0;
    let index = 0;
    let lastPct = -1;
    while (offset < file.size) {
      check();
      while (this.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        await new Promise((r) => setTimeout(r, 20));
        check();
      }
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const chunkBuf = await file.slice(offset, end).arrayBuffer();
      const sealed = await e2e.encryptChunk(index, new Uint8Array(chunkBuf));
      index++;

      // [transferId en claro para que el relay enrute][chunk cifrado E2E]
      const payload = new Uint8Array(TRANSFER_ID_LENGTH + sealed.byteLength);
      payload.set(idBytes, 0);
      payload.set(sealed, TRANSFER_ID_LENGTH);

      await this._sendQueue; // no adelantarse a JSON pendientes
      check();
      const frame = this._cipher ? await this._cipher.encryptBinary(payload) : payload;
      this.ws.send(frame);

      offset = end;
      const pct = Math.floor((offset / file.size) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        onProgress?.(pct);
      }
    }
    check();
    const final = await e2e.encryptFinal(index, file.size, file.name);
    this.sendJson({ type: 'send-complete', transferId, e2e: { final } });
    void log.info('[TransferConnection] sendFile complete', { transferId });
  }

  close() { this.ws.close(); }
}
