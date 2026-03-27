import { useEffect, useRef, useState, useCallback } from 'react';
import { TransferConnection, type TransferClient, type IncomingTransferRequest } from '../api/transfer.api';
import { isTauriApp } from './useDownloadDir';
import { getToken } from '../lib/auth';
import { log } from '../lib/logger';

// crypto.randomUUID no está disponible en contextos no-HTTPS (HTTP sobre LAN)
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Types ───────────────────────────────────────────────────────────

export interface ActiveTransfer {
  transferId: string;
  fileName: string;
  fileSize: number;
  progress: number;
  direction: 'sending' | 'receiving';
  peerName: string;
  peerId: string;
  waiting: boolean; // true while sender awaits accept/reject
}

// ─── Hook ─────────────────────────────────────────────────────────────

/**
 * Manages the WebSocket connection and state for direct peer-to-peer file transfers.
 *
 * Establishes a single WebSocket to the server relay on mount (or when `serverUrl` changes).
 * The `appName` is intentionally kept in a ref so changing it does not cause a reconnect.
 * Received file chunks are buffered in memory and assembled into a `Blob` on completion.
 *
 * @param serverUrl - The backend base URL (e.g. `"http://192.168.1.10:3001"`).
 * @param appName - The display name shown to other connected clients.
 * @param onFileReceived - Callback invoked when a complete file has been received.
 *                         Receives the filename, MIME type, and the assembled `Blob`.
 * @returns An object containing connection state and transfer control functions.
 */
export function useTransfer(
  serverUrl: string,
  appName: string,
  onFileReceived: (fileName: string, mimeType: string, blob: Blob) => void,
  onSendRejected?: () => void,
  authenticated = false,
  onFilesChanged?: () => void,
) {
  const connRef = useRef<TransferConnection | null>(null);
  const pendingSendRef = useRef<{ transferId: string; file: File; peerId: string } | null>(null);
  const receiveBuffers = useRef(
    new Map<string, { chunks: ArrayBuffer[]; received: number; total: number; fileName: string; mimeType: string }>()
  );
  // Keep latest callbacks in refs so changing them doesn't restart the WS connection
  const onFileReceivedRef = useRef(onFileReceived);
  useEffect(() => { onFileReceivedRef.current = onFileReceived; });
  const onSendRejectedRef = useRef(onSendRejected);
  useEffect(() => { onSendRejectedRef.current = onSendRejected; });
  const onFilesChangedRef = useRef(onFilesChanged);
  useEffect(() => { onFilesChangedRef.current = onFilesChanged; });
  const appNameRef = useRef(appName);
  useEffect(() => { appNameRef.current = appName; });

  const [myClientId, setMyClientId] = useState<string | null>(null);
  const [onlineClients, setOnlineClients] = useState<TransferClient[]>([]);
  const [incomingRequest, setIncomingRequest] = useState<IncomingTransferRequest | null>(null);
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer | null>(null);

  // Only re-create the WS connection when the server URL changes, not on appName changes.
  // appName is read from the ref so it's always current without being a dependency.
  useEffect(() => {
    const conn = new TransferConnection(serverUrl);
    connRef.current = conn;

    conn.ws.onopen = () => {
      const token = getToken();
      void log.info('[useTransfer] WS connected', { serverUrl, hasToken: !!token });
      if (token) {
        conn.auth(token);
        // register() and setReceiving() are called on auth_ok below
      } else {
        void log.warn('[useTransfer] WS opened but no token available yet');
      }
    };

    conn.on('auth_ok', () => {
      void log.info('[useTransfer] auth_ok — registering', { appName: appNameRef.current, isServer: isTauriApp() });
      conn.register(appNameRef.current, isTauriApp());
      conn.setReceiving(true);
    });

    conn.on('welcome', (msg) => {
      void log.info('[useTransfer] welcome received', { clientId: msg.clientId });
      setMyClientId(msg.clientId);
    });

    conn.on('clients', (msg) => {
      void log.debug('[useTransfer] clients update', { clients: msg.clients.map((c: TransferClient) => c.appName) });
      setOnlineClients(msg.clients);
    });

    conn.on('files-changed', () => {
      onFilesChangedRef.current?.();
    });

    conn.on('send-request', (msg) => {
      void log.info('[useTransfer] incoming transfer request', { from: msg.fromName, fileName: msg.fileName, fileSize: msg.fileSize });
      setIncomingRequest(msg);
    });

    conn.on('send-accept', async (msg) => {
      const pending = pendingSendRef.current;
      if (!pending || pending.transferId !== msg.transferId) return;
      void log.info('[useTransfer] transfer accepted, starting file send', { transferId: msg.transferId });
      // Mark as active (not waiting anymore)
      setActiveTransfer((prev) => prev ? { ...prev, waiting: false } : null);
      await conn.sendFile(pending.transferId, pending.file, (pct) => {
        setActiveTransfer((prev) => prev ? { ...prev, progress: pct } : null);
      });
      void log.info('[useTransfer] file send finished', { transferId: msg.transferId });
      pendingSendRef.current = null;
      setActiveTransfer(null);
    });

    conn.on('send-reject', (msg) => {
      if (pendingSendRef.current?.transferId === msg.transferId) {
        void log.warn('[useTransfer] transfer rejected by peer', { transferId: msg.transferId });
        pendingSendRef.current = null;
        setActiveTransfer(null);
        onSendRejectedRef.current?.();
      }
    });

    conn.on('send-cancel', (msg) => {
      receiveBuffers.current.delete(msg.transferId);
      if (pendingSendRef.current?.transferId === msg.transferId) {
        pendingSendRef.current = null;
      }
      setActiveTransfer((prev) =>
        prev?.transferId === msg.transferId ? null : prev
      );
    });

    conn.on('send-complete', (msg) => {
      const buf = receiveBuffers.current.get(msg.transferId);
      if (!buf) return;
      void log.info('[useTransfer] file receive complete', { transferId: msg.transferId, fileName: buf.fileName });
      const blob = new Blob(buf.chunks, { type: buf.mimeType || 'application/octet-stream' });
      onFileReceivedRef.current(buf.fileName, buf.mimeType, blob);
      receiveBuffers.current.delete(msg.transferId);
      setActiveTransfer(null);
    });

    conn.onBinary((buf) => {
      const transferId = new TextDecoder().decode(buf.slice(0, 36)).trim();
      const chunk = buf.slice(36);
      const entry = receiveBuffers.current.get(transferId);
      if (!entry) return;
      entry.chunks.push(chunk);
      entry.received += chunk.byteLength;
      const progress = Math.round((entry.received / entry.total) * 100);
      setActiveTransfer((prev) => prev ? { ...prev, progress } : null);
    });

    conn.ws.onerror = (e) => {
      void log.warn('[useTransfer] WebSocket error', { event: String(e) });
    };
    conn.ws.onclose = (e) => {
      void log.info('[useTransfer] WS closed', { code: e.code, reason: e.reason });
    };

    return () => {
      conn.close();
      connRef.current = null;
      pendingSendRef.current = null;
      receiveBuffers.current.clear();
    };
  // authenticated incluido: cuando el token pasa a estar disponible hay que
  // reconectar para que onopen pueda enviar auth → auth_ok → register.
  // appName omitido intencionalmente — se lee del ref para evitar reconectar.
  }, [serverUrl, authenticated]);

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Updates the device display name on the server without restarting the WebSocket connection.
   *
   * @param newName - The new display name to broadcast to other clients.
   */
  const rename = useCallback((newName: string) => {
    appNameRef.current = newName;
    connRef.current?.rename(newName);
  }, []);

  /**
   * Initiates a file transfer to the given peer by sending a `send-request` to the server.
   * Sets `activeTransfer` with `waiting: true` until the peer accepts or rejects.
   *
   * @param toClientId - The `clientId` of the intended recipient.
   * @param file - The `File` object to send.
   * @param peerName - The display name of the recipient (for UI feedback).
   */
  const sendFileTo = useCallback((toClientId: string, file: File, peerName: string) => {
    const conn = connRef.current;
    if (!conn) { void log.warn('[useTransfer] sendFileTo: no connection available'); return; }
    const transferId = generateUUID();
    void log.info('[useTransfer] initiating send', { to: peerName, toClientId, fileName: file.name, transferId });
    pendingSendRef.current = { transferId, file, peerId: toClientId };
    setActiveTransfer({
      transferId,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      direction: 'sending',
      peerName,
      peerId: toClientId,
      waiting: true,
    });
    conn.sendRequest(toClientId, file, transferId);
  }, []);

  /**
   * Accepts the current `incomingRequest`, initializes a receive buffer,
   * sets `activeTransfer` to track progress, and notifies the server.
   * Clears `incomingRequest` afterwards.
   */
  const acceptTransfer = useCallback(() => {
    const req = incomingRequest;
    const conn = connRef.current;
    if (!req || !conn) return;
    void log.info('[useTransfer] accepting incoming transfer', { transferId: req.transferId, from: req.fromName });
    receiveBuffers.current.set(req.transferId, {
      chunks: [],
      received: 0,
      total: req.fileSize,
      fileName: req.fileName,
      mimeType: req.mimeType,
    });
    setActiveTransfer({
      transferId: req.transferId,
      fileName: req.fileName,
      fileSize: req.fileSize,
      progress: 0,
      direction: 'receiving',
      peerName: req.fromName,
      peerId: req.from,
      waiting: false,
    });
    conn.accept(req.transferId);
    setIncomingRequest(null);
  }, [incomingRequest]);

  /**
   * Rejects the current `incomingRequest` and notifies the server.
   * Clears `incomingRequest` afterwards.
   */
  const rejectTransfer = useCallback(() => {
    const req = incomingRequest;
    const conn = connRef.current;
    if (!req || !conn) return;
    void log.info('[useTransfer] rejecting incoming transfer', { transferId: req.transferId, from: req.fromName });
    conn.reject(req.transferId);
    setIncomingRequest(null);
  }, [incomingRequest]);

  /**
   * Cancels the current `activeTransfer` (either sending or receiving).
   * Cleans up the local receive buffer and pending send ref, then notifies the server.
   */
  const cancelTransfer = useCallback(() => {
    const transfer = activeTransfer;
    const conn = connRef.current;
    if (!transfer || !conn) return;
    void log.info('[useTransfer] cancelling transfer', { transferId: transfer.transferId, direction: transfer.direction });
    conn.cancel(transfer.transferId);
    receiveBuffers.current.delete(transfer.transferId);
    pendingSendRef.current = null;
    setActiveTransfer(null);
  }, [activeTransfer]);

  return {
    myClientId,
    onlineClients,
    incomingRequest,
    activeTransfer,
    sendFileTo,
    acceptTransfer,
    rejectTransfer,
    cancelTransfer,
    rename,
  };
}
