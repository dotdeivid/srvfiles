import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  TransferConnection, CancelToken, TransferAbortedError,
  type TransferClient, type IncomingTransferRequest,
} from './transfer.api';
import { getToken } from '../auth/auth.service';
import { createReceiveSink, type ReceiveSink } from '../../lib/receive';
import { createE2EKeyPair, isE2EAvailable, E2ESession, type E2EKeyPair } from '../../lib/e2e';
import { log } from '../../lib/logger';

/** UUID v4 con crypto.getRandomValues (crypto.randomUUID no existe sobre HTTP). */
function generateUUID(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
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
  /** Código de verificación E2E (6 dígitos) — el emisor lo ve cuando llega la clave del receptor. */
  sas?: string;
}

/** Solicitud entrante con su sesión E2E ya derivada y el código a comparar. */
export interface PendingRequest extends IncomingTransferRequest {
  sas: string;
  /** Momento (ms epoch) en que se rechaza sola si nadie responde. */
  expiresAt: number;
}

interface PendingSend {
  transferId: string;
  file: File;
  peerId: string;
  cancel: CancelToken;
  keyPair: E2EKeyPair;
  session: E2ESession | null;
}

interface Receiving {
  sink: ReceiveSink;
  session: E2ESession;
  /** Índice del próximo chunk esperado (también cuenta los chunks recibidos). */
  nextIndex: number;
  received: number;
  total: number;
  fileName: string;
  work: Promise<void>;
  failed: string | null;
}

interface Options {
  serverUrl: string;
  appName: string;
  authenticated: boolean;
  /** true en la app de escritorio: se anuncia como servidor con su puerto. */
  isServer: boolean;
  serverPort?: number;
  onFilesChanged?: () => void;
  /** Tras reconectar (para recargar la lista de archivos). */
  onReconnected?: () => void;
}

const BACKOFF_MS = [1000, 2000, 5000, 10000, 20000, 30000];
const MAX_PENDING_REQUESTS = 5;
/** Tiempo que se espera la respuesta del usuario antes de rechazar sola. */
export const REQUEST_TIMEOUT_MS = 60_000;

const rejectMessage = (reason?: string) => {
  switch (reason) {
    case 'offline': return 'El destinatario ya no está conectado';
    case 'busy': return 'El destinatario está ocupado con otra transferencia';
    case 'timeout': return 'El destinatario no respondió';
    case 'e2e-unsupported':
    case 'e2e-required': return 'El otro dispositivo necesita actualizar SrvFiles (cifrado de extremo a extremo)';
    case 'e2e-unavailable': return 'El otro dispositivo abrió SrvFiles sin HTTPS y no puede recibir archivos cifrados';
    default: return 'El destinatario rechazó el envío';
  }
};

// ─── Hook ─────────────────────────────────────────────────────────────

/**
 * WebSocket al relay y estado de las transferencias directas.
 *
 * - Cifrado de extremo a extremo obligatorio: cada transferencia negocia su
 *   propia clave entre emisor y receptor (lib/e2e.ts). El receptor solo puede
 *   aceptar confirmando que el código de verificación coincide con el que ve
 *   el emisor.
 * - Reconecta solo con backoff si la conexión se pierde.
 * - Las solicitudes entrantes se encolan (de a una en pantalla); si ya hay
 *   una transferencia en curso se rechazan con "busy".
 * - Lo recibido se descifra y escribe a disco a medida que llega; al final se
 *   verifica el marcador cifrado (cantidad de chunks, tamaño y nombre).
 */
export function useTransfer({
  serverUrl, appName, authenticated, isServer, serverPort, onFilesChanged, onReconnected,
}: Options) {
  const connRef = useRef<TransferConnection | null>(null);
  const pendingSendRef = useRef<PendingSend | null>(null);
  const receivingRef = useRef(new Map<string, Receiving>());
  const sessionsRef = useRef(new Map<string, E2ESession>()); // solicitudes aún sin responder
  const requestTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const activeRef = useRef<ActiveTransfer | null>(null);

  const callbacks = useRef({ onFilesChanged, onReconnected, appName, isServer, serverPort });
  useEffect(() => { callbacks.current = { onFilesChanged, onReconnected, appName, isServer, serverPort }; });

  const [connected, setConnected] = useState(false);
  const [encrypted, setEncrypted] = useState(false);
  const [myClientId, setMyClientId] = useState<string | null>(null);
  const [onlineClients, setOnlineClients] = useState<TransferClient[]>([]);
  const [requests, setRequestsState] = useState<PendingRequest[]>([]);
  const requestsRef = useRef<PendingRequest[]>([]);
  const setRequests = useCallback((next: PendingRequest[]) => {
    requestsRef.current = next;
    setRequestsState(next);
  }, []);
  const [activeTransfer, setActiveTransferState] = useState<ActiveTransfer | null>(null);

  const setActive = useCallback((next: ActiveTransfer | null | ((prev: ActiveTransfer | null) => ActiveTransfer | null)) => {
    setActiveTransferState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      activeRef.current = value;
      return value;
    });
  }, []);

  const dropRequest = useCallback((transferId: string) => {
    const timer = requestTimers.current.get(transferId);
    if (timer) clearTimeout(timer);
    requestTimers.current.delete(transferId);
    sessionsRef.current.delete(transferId);
    setRequests(requestsRef.current.filter((r) => r.transferId !== transferId));
  }, [setRequests]);

  const abortReceive = useCallback((transferId: string, message?: string) => {
    const rec = receivingRef.current.get(transferId);
    receivingRef.current.delete(transferId);
    if (rec) void rec.sink.abort();
    setActive((prev) => (prev?.transferId === transferId ? null : prev));
    if (message) toast.error(message);
  }, [setActive]);

  // ─── Connection lifecycle (with reconnection) ─────────────────────
  useEffect(() => {
    if (!authenticated) return;
    const receiving = receivingRef.current;
    const timers = requestTimers.current;
    const sessions = sessionsRef.current;
    let disposed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let everConnected = false;

    const connect = () => {
      const token = getToken(serverUrl);
      if (!token || disposed) return;
      const conn = new TransferConnection(serverUrl);
      connRef.current = conn;

      conn.ws.onopen = () => conn.auth(token);

      conn.onReady = (isEncrypted) => {
        attempt = 0;
        setConnected(true);
        setEncrypted(isEncrypted);
        const { appName: name, isServer: server, serverPort: port } = callbacks.current;
        conn.register(name, server, port);
        conn.setReceiving(isE2EAvailable());
        if (everConnected) callbacks.current.onReconnected?.();
        everConnected = true;
      };

      conn.on('welcome', (msg) => setMyClientId(msg.clientId));
      conn.on('clients', (msg) => setOnlineClients(msg.clients));
      conn.on('files-changed', () => callbacks.current.onFilesChanged?.());

      // ── Receptor: llega una solicitud ──────────────────────────────
      conn.on('send-request', async (msg) => {
        void log.info('[useTransfer] incoming transfer request', { from: msg.fromName, fileSize: msg.fileSize });
        const senderKey = msg.e2e?.publicKey;
        if (!senderKey) {
          conn.reject(msg.transferId, 'e2e-required');
          return;
        }
        if (!isE2EAvailable()) {
          conn.reject(msg.transferId, 'e2e-unavailable');
          toast.error(`${msg.fromName} quiso enviarte un archivo: abrí SrvFiles por HTTPS para poder recibirlo`);
          return;
        }
        // Ocupado: rechazar sin molestar al usuario.
        if (activeRef.current || requestsRef.current.length >= MAX_PENDING_REQUESTS) {
          conn.reject(msg.transferId, 'busy');
          return;
        }
        try {
          // La clave del receptor se manda enseguida: el emisor necesita el
          // código para mostrarlo mientras el receptor decide.
          const own = await createE2EKeyPair();
          const session = await E2ESession.derive(own.privateKey, senderKey, senderKey, own.publicKey, msg.transferId);
          sessions.set(msg.transferId, session);
          conn.sendKey(msg.transferId, own.publicKey);
          timers.set(msg.transferId, setTimeout(() => {
            conn.reject(msg.transferId, 'timeout');
            dropRequest(msg.transferId);
          }, REQUEST_TIMEOUT_MS));
          setRequests([...requestsRef.current, {
            transferId: msg.transferId, from: msg.from, fromName: msg.fromName,
            fileName: msg.fileName, fileSize: msg.fileSize, mimeType: msg.mimeType,
            senderPublicKey: senderKey, sas: session.sas,
            expiresAt: Date.now() + REQUEST_TIMEOUT_MS,
          }]);
        } catch (err) {
          void log.warn('[useTransfer] invalid E2E key from sender', { error: String(err) });
          conn.reject(msg.transferId, 'e2e-required');
        }
      });

      // ── Emisor: llega la clave del receptor → código de verificación ──
      conn.on('send-key', async (msg) => {
        const pending = pendingSendRef.current;
        if (!pending || pending.transferId !== msg.transferId || pending.session) return;
        try {
          pending.session = await E2ESession.derive(
            pending.keyPair.privateKey, msg.publicKey, pending.keyPair.publicKey, msg.publicKey, pending.transferId,
          );
          const sas = pending.session.sas;
          setActive((prev) => (prev?.transferId === pending.transferId ? { ...prev, sas } : prev));
        } catch (err) {
          void log.warn('[useTransfer] invalid E2E key from receiver', { error: String(err) });
          conn.cancel(pending.transferId);
          pendingSendRef.current = null;
          setActive(null);
          toast.error('No se pudo establecer el cifrado con el destinatario');
        }
      });

      conn.on('send-accept', async (msg) => {
        const pending = pendingSendRef.current;
        if (!pending || pending.transferId !== msg.transferId) return;
        if (!pending.session) {
          // Aceptó sin intercambiar claves: no se envía nada sin E2E.
          conn.cancel(pending.transferId);
          pendingSendRef.current = null;
          setActive(null);
          toast.error('El destinatario no completó el cifrado de extremo a extremo');
          return;
        }
        setActive((prev) => (prev ? { ...prev, waiting: false } : null));
        try {
          await conn.sendFile(pending.transferId, pending.file, pending.session, (pct) => {
            setActive((prev) => (prev?.transferId === pending.transferId ? { ...prev, progress: pct } : prev));
          }, pending.cancel);
          if (pendingSendRef.current?.transferId === pending.transferId) {
            toast.success(`"${pending.file.name}" enviado`);
          }
        } catch (err) {
          if (pendingSendRef.current?.transferId !== pending.transferId) return; // ya informado
          if (err instanceof TransferAbortedError && err.reason === 'cancelled') return;
          toast.error(err instanceof TransferAbortedError
            ? 'Se perdió la conexión: envío cancelado'
            : `Error al enviar "${pending.file.name}"`);
        } finally {
          if (pendingSendRef.current?.transferId === pending.transferId) {
            pendingSendRef.current = null;
            setActive(null);
          }
        }
      });

      conn.on('send-reject', (msg) => {
        if (pendingSendRef.current?.transferId !== msg.transferId) return;
        pendingSendRef.current.cancel.cancel();
        pendingSendRef.current = null;
        setActive(null);
        toast.error(rejectMessage(msg.reason));
      });

      conn.on('send-cancel', (msg) => {
        dropRequest(msg.transferId);
        if (pendingSendRef.current?.transferId === msg.transferId) {
          pendingSendRef.current.cancel.cancel();
          pendingSendRef.current = null;
          setActive(null);
          toast.info('El destinatario canceló la transferencia');
        }
        if (receiving.has(msg.transferId)) {
          abortReceive(msg.transferId);
          toast.info('El emisor canceló la transferencia');
        }
      });

      // ── Receptor: fin de la transferencia ─────────────────────────
      conn.on('send-complete', async (msg) => {
        const rec = receiving.get(msg.transferId);
        if (!rec) return;
        receiving.delete(msg.transferId);
        await rec.work;

        let problem = rec.failed;
        if (!problem) {
          try {
            const final = await rec.session.decryptFinal(rec.nextIndex, msg.e2e?.final ?? '');
            // Cantidad de chunks, tamaño y nombre autenticados por el emisor.
            if (final.chunks !== rec.nextIndex || final.size !== rec.received
              || final.size !== rec.total || final.name !== rec.fileName) {
              problem = `"${rec.fileName}" llegó incompleto o alterado y se descartó`;
            }
          } catch {
            problem = `"${rec.fileName}" llegó incompleto o alterado y se descartó`;
          }
        }
        if (problem) {
          void rec.sink.abort();
          setActive(null);
          toast.error(problem);
          return;
        }
        try {
          const where = await rec.sink.finish();
          toast.success(where ? `"${rec.fileName}" guardado en ${where}` : `"${rec.fileName}" recibido`);
        } catch (err) {
          void log.error('[useTransfer] could not finish receive', { error: String(err) });
          toast.error(`No se pudo guardar "${rec.fileName}"`);
        }
        setActive(null);
      });

      // ── Receptor: chunks (en orden de llegada; ver TransferConnection) ──
      conn.onBinary((buf) => {
        const transferId = new TextDecoder().decode(buf.slice(0, 36)).trim();
        const rec = receiving.get(transferId);
        if (!rec || rec.failed) return;
        const index = rec.nextIndex++;
        const sealed = new Uint8Array(buf.slice(36));
        rec.work = rec.work.then(async () => {
          if (rec.failed) return;
          let chunk: Uint8Array<ArrayBuffer>;
          try {
            chunk = await rec.session.decryptChunk(index, sealed);
          } catch {
            rec.failed = `"${rec.fileName}": datos alterados o fuera de orden, se descartó`;
            conn.cancel(transferId);
            abortReceive(transferId, rec.failed);
            return;
          }
          if (rec.received + chunk.byteLength > rec.total) {
            rec.failed = 'El archivo recibido no coincide con el tamaño anunciado';
            conn.cancel(transferId);
            abortReceive(transferId, rec.failed);
            return;
          }
          rec.received += chunk.byteLength;
          const progress = rec.total > 0 ? Math.floor((rec.received / rec.total) * 100) : 0;
          setActive((prev) => (prev?.transferId === transferId && prev.progress !== progress ? { ...prev, progress } : prev));
          try {
            await rec.sink.write(chunk);
          } catch (err) {
            rec.failed = `No se pudo guardar "${rec.fileName}"`;
            void log.error('[useTransfer] write failed', { error: String(err) });
          }
        });
      });

      conn.ws.onclose = (e) => {
        if (connRef.current !== conn) return;
        connRef.current = null;
        setConnected(false);
        setEncrypted(false);
        setMyClientId(null);
        setOnlineClients([]);
        // Lo que estaba en curso por esta conexión ya no puede terminar.
        if (pendingSendRef.current) {
          pendingSendRef.current.cancel.cancel();
          pendingSendRef.current = null;
          setActive(null);
          toast.error('Se perdió la conexión: envío cancelado');
        }
        for (const id of [...receiving.keys()]) {
          abortReceive(id, 'Se perdió la conexión: recepción cancelada');
        }
        for (const id of [...timers.keys()]) dropRequest(id);
        if (disposed || e.code === 4401) return; // 4401: el token dejó de valer (pide PIN)
        const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        attempt++;
        void log.info('[useTransfer] WS closed — reconnecting', { code: e.code, delay });
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      connRef.current?.close();
      connRef.current = null;
      pendingSendRef.current?.cancel.cancel();
      pendingSendRef.current = null;
      for (const rec of receiving.values()) void rec.sink.abort();
      receiving.clear();
      sessions.clear();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      setRequests([]);
      setActive(null);
      setConnected(false);
      setMyClientId(null);
      setOnlineClients([]);
    };
  }, [serverUrl, authenticated, abortReceive, dropRequest, setActive, setRequests]);

  // ─── Public API ──────────────────────────────────────────────────

  /** Updates the display name without reconnecting. */
  const rename = useCallback((newName: string) => {
    callbacks.current.appName = newName;
    connRef.current?.rename(newName);
  }, []);

  /** Ofrece un archivo a `toClientId`. Queda "esperando" hasta que acepte o rechace. */
  const sendFileTo = useCallback(async (toClientId: string, file: File, peerName: string) => {
    const conn = connRef.current;
    if (!conn || activeRef.current) return;
    if (!isE2EAvailable()) {
      toast.error('Abrí SrvFiles por HTTPS para enviar archivos (el cifrado de extremo a extremo lo requiere)');
      return;
    }
    const transferId = generateUUID();
    const keyPair = await createE2EKeyPair();
    pendingSendRef.current = { transferId, file, peerId: toClientId, cancel: new CancelToken(), keyPair, session: null };
    setActive({
      transferId, fileName: file.name, fileSize: file.size, progress: 0,
      direction: 'sending', peerName, peerId: toClientId, waiting: true,
    });
    conn.sendRequest(toClientId, file, transferId, keyPair.publicKey);
  }, [setActive]);

  /**
   * Acepta la primera solicitud. Debe llamarse desde el clic en "Aceptar"
   * (tras confirmar el código): en navegadores con File System Access API
   * abre el diálogo de guardado, que requiere un gesto del usuario.
   */
  const acceptTransfer = useCallback(async () => {
    const req = requestsRef.current[0];
    const conn = connRef.current;
    if (!req || !conn) return;
    const session = sessionsRef.current.get(req.transferId);
    dropRequest(req.transferId);
    if (!session) {
      conn.reject(req.transferId, 'e2e-required');
      return;
    }

    let sink: ReceiveSink;
    try {
      sink = await createReceiveSink(req.transferId, req.fileName, req.mimeType);
    } catch (err) {
      void log.warn('[useTransfer] receive destination not available', { error: String(err) });
      conn.reject(req.transferId);
      toast.info('Transferencia rechazada');
      return;
    }
    receivingRef.current.set(req.transferId, {
      sink, session, nextIndex: 0, received: 0, total: req.fileSize, fileName: req.fileName,
      work: Promise.resolve(), failed: null,
    });
    setActive({
      transferId: req.transferId, fileName: req.fileName, fileSize: req.fileSize, progress: 0,
      direction: 'receiving', peerName: req.fromName, peerId: req.from, waiting: false, sas: req.sas,
    });
    conn.accept(req.transferId);
  }, [dropRequest, setActive]);

  /** Rechaza la primera solicitud. */
  const rejectTransfer = useCallback(() => {
    const req = requestsRef.current[0];
    if (!req) return;
    connRef.current?.reject(req.transferId);
    dropRequest(req.transferId);
  }, [dropRequest]);

  /** Cancela la transferencia en curso (envío o recepción). */
  const cancelTransfer = useCallback(() => {
    const transfer = activeRef.current;
    if (!transfer) return;
    connRef.current?.cancel(transfer.transferId);
    if (pendingSendRef.current?.transferId === transfer.transferId) {
      pendingSendRef.current.cancel.cancel();
      pendingSendRef.current = null;
      setActive(null);
    } else {
      abortReceive(transfer.transferId);
    }
    toast.info('Transferencia cancelada');
  }, [abortReceive, setActive]);

  return {
    connected,
    encrypted,
    /** false si el navegador no permite cifrado (página abierta por HTTP). */
    e2eAvailable: isE2EAvailable(),
    myClientId,
    onlineClients,
    incomingRequest: requests[0] ?? null,
    pendingRequests: requests.length,
    activeTransfer,
    sendFileTo,
    acceptTransfer,
    rejectTransfer,
    cancelTransfer,
    rename,
  };
}
