import { getApiUrl } from './files.api';
import { log } from '../lib/logger';

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
  | { type: 'welcome'; clientId: string }
  | { type: 'clients'; clients: TransferClient[] }
  | { type: 'send-request'; from: string; fromName: string; fileName: string; fileSize: number; mimeType: string; transferId: string }
  | { type: 'send-accept'; transferId: string }
  | { type: 'send-reject'; transferId: string; reason?: string }
  | { type: 'send-cancel'; transferId: string }
  | { type: 'send-complete'; transferId: string }
  | { type: 'files-changed' };

// ─── Chunk size ──────────────────────────────────────────────────────
// 256 KB per chunk — balanced for LAN speeds without memory bloat
const CHUNK_SIZE = 256 * 1024;

// ─── TransferConnection ──────────────────────────────────────────────

/**
 * Manages a WebSocket connection to the SrvFiles transfer relay server.
 *
 * Handles both JSON signaling messages (session negotiation) and binary
 * frames (file chunk relay). Each binary frame is prefixed with the
 * 36-byte transfer ID so the server can route chunks to the correct receiver.
 *
 * Usage:
 * 1. Instantiate with the server URL.
 * 2. Call `register(appName)` once the socket opens.
 * 3. Use `on()` / `onBinary()` to react to incoming messages.
 * 4. Call `sendRequest()` to initiate a transfer, then `sendFile()` after acceptance.
 */
export class TransferConnection {
  ws: WebSocket;
  private clientId: string | null = null;
  private handlers = new Map<string, (msg: any) => void>();
  private binaryHandlers: ((buf: ArrayBuffer) => void)[] = [];

  /**
   * Opens a WebSocket connection to `${serverUrl}/ws`.
   * Automatically routes incoming text frames to registered handlers
   * and binary frames to binary handlers.
   *
   * @param serverUrl - The HTTP base URL of the SrvFiles server (e.g. `"http://192.168.1.10:3001"`).
   *                    The constructor converts it to a `ws://` URL internally.
   */
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
        void log.debug(`[TransferConnection] message received: ${msg.type}`);
        this.handlers.get(msg.type)?.(msg);
      } catch (err) {
        void log.warn('[TransferConnection] malformed WS message ignored', { error: String(err) });
      }
    };
  }

  /**
   * Returns the client ID assigned by the server after a successful `hello` handshake.
   *
   * @returns The client ID string, or `null` before the welcome message is received.
   */
  getClientId() { return this.clientId; }

  /**
   * Registers a typed handler for a specific server message type.
   * Only one handler per type is kept — registering again overwrites the previous one.
   *
   * @param type - The message type to listen for (e.g. `'send-request'`).
   * @param handler - Callback invoked with the typed message payload.
   * @returns `this` for chaining.
   */
  on<T extends ServerMessage['type']>(
    type: T,
    handler: (msg: Extract<ServerMessage, { type: T }>) => void
  ) {
    this.handlers.set(type, handler as any);
    return this;
  }

  /**
   * Registers a handler for incoming binary frames (file chunks).
   * Multiple handlers can be registered and all will be called.
   *
   * @param handler - Callback invoked with the raw `ArrayBuffer` of the frame.
   * @returns `this` for chaining.
   */
  onBinary(handler: (buf: ArrayBuffer) => void) {
    this.binaryHandlers.push(handler);
    return this;
  }

  /**
   * Serializes `msg` to JSON and sends it over the WebSocket.
   * Does nothing if the socket is not in the `OPEN` state.
   *
   * @param msg - Any JSON-serializable object.
   */
  private sendJson(msg: object) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      void log.warn('[TransferConnection] sendJson: socket not open', { readyState: this.ws.readyState });
    }
  }

  /**
   * Sends the `auth` message with the session token obtained via POST /api/auth.
   * The server responds with `auth_ok` if valid, or closes with 4401.
   * Must be called before `register()`.
   *
   * @param token - The session token from sessionStorage.
   */
  auth(token: string) {
    this.sendJson({ type: 'auth', token });
  }

  /**
   * Sends the initial `hello` message to register this client on the server.
   * The server responds with a `welcome` message containing the assigned `clientId`.
   * Must be called after `auth_ok` is received.
   *
   * @param appName - The display name shown to other connected clients.
   */
  register(appName: string, isServer = false) {
    this.sendJson({ type: 'hello', appName, deviceType: 'desktop', isServer });
  }

  /**
   * Notifies the server whether this client is currently willing to receive files.
   * The server broadcasts the updated state to all connected clients.
   *
   * @param receiving - `true` to advertise availability for incoming transfers.
   */
  setReceiving(receiving: boolean) {
    this.sendJson({ type: 'set-receiving', receiving });
  }

  /**
   * Sends a transfer request to a specific peer, asking them to accept a file.
   * The server relays the request to the target client.
   *
   * @param to - The `clientId` of the intended recipient.
   * @param file - The `File` object to be sent (used to extract metadata).
   * @param transferId - A UUID generated by the caller to uniquely identify this transfer.
   */
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

  /**
   * Accepts an incoming transfer request. The server notifies the sender to begin sending chunks.
   *
   * @param transferId - The transfer ID from the `send-request` message.
   */
  accept(transferId: string) { this.sendJson({ type: 'send-accept', transferId }); }

  /**
   * Rejects an incoming transfer request. The server notifies the sender.
   *
   * @param transferId - The transfer ID from the `send-request` message.
   */
  reject(transferId: string) { this.sendJson({ type: 'send-reject', transferId }); }

  /**
   * Cancels an active transfer (can be called by either sender or receiver).
   * The server notifies the other party and removes the session.
   *
   * @param transferId - The transfer ID of the session to cancel.
   */
  cancel(transferId: string) { this.sendJson({ type: 'send-cancel', transferId }); }

  /**
   * Updates this client's display name on the server without restarting the connection.
   * The server broadcasts the updated name to all connected clients.
   *
   * @param newName - The new display name.
   */
  rename(newName: string) { this.sendJson({ type: 'rename', newName }); }

  /**
   * Reads `file` in 256 KB chunks and sends each as a binary WebSocket frame.
   * Each frame is prefixed with the 36-byte ASCII transfer ID (padded with spaces)
   * so the relay server can route chunks to the correct receiver.
   * Yields to the event loop between chunks to avoid blocking the UI.
   * Sends a `send-complete` JSON message when all chunks have been transmitted.
   *
   * @param transferId - The UUID identifying this transfer session.
   * @param file - The `File` object to read and send.
   * @param onProgress - Optional callback invoked with the current progress (0–100).
   * @returns A promise that resolves once all chunks have been sent.
   */
  async sendFile(transferId: string, file: File, onProgress?: (pct: number) => void) {
    void log.info('[TransferConnection] sendFile started', { transferId, fileName: file.name, fileSize: file.size });
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
    void log.info('[TransferConnection] sendFile complete', { transferId });
  }

  /**
   * Closes the underlying WebSocket connection.
   */
  close() { this.ws.close(); }
}

// ─── Helper ──────────────────────────────────────────────────────────

/**
 * Converts an HTTP server URL to its WebSocket equivalent by replacing
 * the `http` scheme with `ws` (or `https` with `wss`) and appending `/ws`.
 *
 * @param serverUrl - Optional HTTP base URL. Defaults to `getApiUrl()`.
 * @returns The WebSocket endpoint URL (e.g. `"ws://192.168.1.10:3001/ws"`).
 */
export function getTransferWsUrl(serverUrl?: string): string {
  return (serverUrl || getApiUrl()).replace(/^http/, 'ws') + '/ws';
}
