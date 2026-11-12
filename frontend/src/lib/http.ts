import { getToken, clearToken } from '../features/auth/auth.service';
import { log } from './logger';
import { timeoutSignal } from './signal';

/** El servidor respondió 401: hay que volver a pedir el PIN. */
export class AuthError extends Error {
  constructor() {
    super('Se requiere el PIN del servidor');
    this.name = 'AuthError';
  }
}

/** Error con un mensaje apto para mostrar al usuario. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Operación cancelada por el usuario. */
export class CancelledError extends Error {
  constructor() {
    super('Operación cancelada');
    this.name = 'CancelledError';
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;


/** Mensaje en español para un código HTTP, priorizando el `error` del servidor. */
export function messageForStatus(status: number, serverMessage?: string, action = 'completar la operación'): string {
  if (serverMessage && status !== 500) return serverMessage;
  switch (status) {
    case 404: return 'No se encontró el archivo en el servidor';
    case 413: return 'El archivo es demasiado grande para el servidor';
    case 429: return 'Demasiados intentos. Esperá un minuto.';
    case 507: return 'El servidor no tiene espacio suficiente';
  }
  if (status >= 500) return `El servidor tuvo un error al ${action}`;
  return `No se pudo ${action} (error ${status})`;
}

/** Mensaje en español para cualquier error de red/API. */
export function errorMessage(err: unknown, action = 'completar la operación'): string {
  if (err instanceof ApiError || err instanceof AuthError || err instanceof CancelledError) return err.message;
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return 'El servidor tardó demasiado en responder';
  }
  return `No se pudo ${action}. Revisá la conexión con el servidor.`;
}

async function readError(res: Response): Promise<string | undefined> {
  try {
    const body = await res.json();
    return typeof body?.error === 'string' ? body.error : undefined;
  } catch {
    return undefined;
  }
}

interface RequestOptions {
  method?: string;
  body?: BodyInit;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  action?: string;
}

/**
 * fetch contra el backend con el token del servidor, timeout y errores
 * traducidos. Un 401 olvida el token de ese servidor y lanza AuthError.
 */
export async function apiFetch<T>(baseUrl: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers };
  const token = getToken(baseUrl);
  if (token) headers['X-SrvFiles-Token'] = token;

  const signal = timeoutSignal(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, opts.signal);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, { method: opts.method ?? 'GET', body: opts.body, headers, signal });
  } catch (err) {
    if (opts.signal?.aborted) throw new CancelledError();
    void log.warn('[http] request failed', { path, error: String(err) });
    throw err;
  }

  if (res.status === 401) {
    void log.warn('[http] 401 — clearing token', { baseUrl, path });
    clearToken(baseUrl);
    throw new AuthError();
  }
  if (!res.ok) {
    throw new ApiError(messageForStatus(res.status, await readError(res), opts.action), res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * POST multipart con progreso de subida (fetch no lo informa) y cancelación.
 * El navegador lee los File en streaming, sin cargarlos en memoria.
 */
export function uploadWithProgress<T>(
  baseUrl: string,
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseUrl}${path}`);
    const token = getToken(baseUrl);
    if (token) xhr.setRequestHeader('X-SrvFiles-Token', token);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: unknown;
      try { body = JSON.parse(xhr.responseText); } catch { body = undefined; }
      if (xhr.status === 401) {
        clearToken(baseUrl);
        reject(new AuthError());
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const serverMsg = (body as { error?: string } | undefined)?.error;
        const err = new ApiError(messageForStatus(xhr.status, serverMsg, 'subir los archivos'), xhr.status);
        (err as ApiError & { body?: unknown }).body = body;
        reject(err);
        return;
      }
      resolve(body as T);
    };
    xhr.onerror = () => reject(new ApiError('No se pudo subir. Revisá la conexión con el servidor.', 0));
    xhr.onabort = () => reject(new CancelledError());

    if (signal) {
      if (signal.aborted) { reject(new CancelledError()); return; }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(form);
  });
}
