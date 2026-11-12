import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createFilesApi, type FileInfo, type DiskStats, type AppConfig, type FailedFile, type UploadResult } from './files.api';
import { getToken } from '../auth/auth.service';
import { AuthError, CancelledError, errorMessage } from '../../lib/http';
import { nativeUpload, onNativeProgress, cancelNativeTransfer } from '../../lib/tauri';
import { log } from '../../lib/logger';

/** Archivo elegido para subir: del selector/drag del navegador o una ruta de Tauri. */
export type UploadItem =
  | { kind: 'file'; file: File; name: string; size: number }
  | { kind: 'path'; path: string; name: string; size: number };

export interface UploadOutcome {
  ok: boolean;
  failed: FailedFile[];
  cancelled?: boolean;
}

interface UseFilesReturn {
  files: FileInfo[];
  stats: DiskStats | null;
  config: AppConfig | null;
  loading: boolean;
  uploading: boolean;
  /** 0–100 */
  uploadProgress: number;
  error: string | null;
  refresh: () => Promise<void>;
  upload: (items: UploadItem[]) => Promise<UploadOutcome>;
  cancelUpload: () => void;
  remove: (filename: string) => Promise<boolean>;
  getLinkedUrl: (filename: string, kind: 'download' | 'preview') => Promise<string>;
  getPlainDownloadUrl: (filename: string) => string;
}

/**
 * Estado de archivos de un servidor: lista, espacio en disco y configuración.
 *
 * No hace polling: la lista se refresca con el evento "files-changed" del
 * WebSocket (ver useTransfer), al reconectar, y tras subir o borrar.
 * Las respuestas de un servidor anterior se descartan al cambiar de servidor.
 *
 * @param serverUrl - backend base URL, or null while paused (PIN dialog open).
 */
export function useFiles(serverUrl: string | null): UseFilesReturn {
  const api = useMemo(() => (serverUrl ? createFilesApi(serverUrl) : null), [serverUrl]);
  const apiRef = useRef(api);
  apiRef.current = api;

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [stats, setStats] = useState<DiskStats | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const uploadAbort = useRef<(() => void) | null>(null);

  const refresh = useCallback(async () => {
    const current = api;
    if (!current) return;
    try {
      const [list, disk] = await Promise.all([current.getFiles(), current.getStats().catch(() => null)]);
      if (apiRef.current !== current) return; // cambió de servidor
      setFiles(list.files);
      if (disk) setStats(disk);
      setError(null);
    } catch (err) {
      if (apiRef.current !== current || err instanceof AuthError) return;
      setError(errorMessage(err, 'obtener la lista de archivos'));
      void log.error('[useFiles] refresh failed', { error: String(err) });
    }
  }, [api]);

  // ─── Initial fetch / server change ─────────────────────────────────
  useEffect(() => {
    setFiles([]);
    setStats(null);
    setConfig(null);
    setError(null);
    if (!api) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const [list, disk, cfg] = await Promise.all([
          api.getFiles(controller.signal),
          api.getStats(controller.signal).catch(() => null),
          api.getConfig(controller.signal).catch(() => null),
        ]);
        setFiles(list.files);
        setStats(disk);
        setConfig(cfg);
      } catch (err) {
        if (controller.signal.aborted || err instanceof AuthError || err instanceof CancelledError) return;
        setError(errorMessage(err, 'conectar con el servidor'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [api]);

  // ─── Upload ────────────────────────────────────────────────────────
  const upload = useCallback(async (items: UploadItem[]): Promise<UploadOutcome> => {
    const current = api;
    if (!current || items.length === 0) return { ok: false, failed: [] };

    const fileItems = items.filter((i): i is Extract<UploadItem, { kind: 'file' }> => i.kind === 'file');
    const pathItems = items.filter((i): i is Extract<UploadItem, { kind: 'path' }> => i.kind === 'path');
    const totalBytes = items.reduce((sum, i) => sum + i.size, 0) || 1;
    let doneBytes = 0;
    let cancelled = false;
    const failed: FailedFile[] = [];

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    void log.info('[useFiles] uploading', { count: items.length });

    try {
      if (fileItems.length > 0) {
        const controller = new AbortController();
        uploadAbort.current = () => { cancelled = true; controller.abort(); };
        const batchBytes = fileItems.reduce((s, i) => s + i.size, 0);
        const result = await current.uploadFiles(
          fileItems.map((i) => i.file),
          (f) => setUploadProgress(Math.round(((doneBytes + f * batchBytes) / totalBytes) * 100)),
          controller.signal,
        );
        failed.push(...(result.failed ?? []));
        doneBytes += batchBytes;
      }
      if (pathItems.length > 0 && !cancelled) {
        const id = crypto.randomUUID();
        uploadAbort.current = () => { cancelled = true; void cancelNativeTransfer(id); };
        const base = doneBytes;
        const unlisten = await onNativeProgress('upload-progress', id, (p) => {
          setUploadProgress(Math.round(((base + p.loaded) / totalBytes) * 100));
        });
        try {
          const result = await nativeUpload<UploadResult>(
            `${current.baseUrl}/api/files/upload`,
            getToken(current.baseUrl),
            pathItems.map((i) => i.path),
            id,
          );
          failed.push(...(result.failed ?? []));
        } finally {
          unlisten();
        }
      }
      await refresh();
      return { ok: failed.length === 0, failed };
    } catch (err) {
      if (cancelled || err instanceof CancelledError || String(err).includes('cancelled')) {
        await refresh();
        return { ok: false, failed, cancelled: true };
      }
      if (String(err).includes('unauthorized')) {
        return { ok: false, failed };
      }
      const body = (err as { body?: UploadResult }).body;
      if (body?.failed) failed.push(...body.failed);
      setError(err instanceof Error && !(err instanceof TypeError) ? err.message : errorMessage(err, 'subir los archivos'));
      void log.error('[useFiles] upload failed', { error: String(err) });
      return { ok: false, failed };
    } finally {
      uploadAbort.current = null;
      setUploading(false);
      setUploadProgress(0);
    }
  }, [api, refresh]);

  const cancelUpload = useCallback(() => {
    uploadAbort.current?.();
  }, []);

  // ─── Delete ────────────────────────────────────────────────────────
  const remove = useCallback(async (filename: string): Promise<boolean> => {
    if (!api) return false;
    try {
      await api.deleteFile(filename);
      await refresh();
      return true;
    } catch (err) {
      void log.error('[useFiles] delete failed', { filename, error: String(err) });
      return false;
    }
  }, [api, refresh]);

  // Estables entre renders: PreviewModal pide el enlace en un efecto que
  // depende de esta función.
  const getLinkedUrl = useCallback(
    (name: string, kind: 'download' | 'preview') =>
      (api ? api.getLinkedUrl(name, kind) : Promise.reject(new Error('sin servidor'))),
    [api],
  );
  const getPlainDownloadUrl = useCallback((name: string) => api?.getPlainDownloadUrl(name) ?? '', [api]);

  return {
    files,
    stats,
    config,
    loading,
    uploading,
    uploadProgress,
    error,
    refresh,
    upload,
    cancelUpload,
    remove,
    getLinkedUrl,
    getPlainDownloadUrl,
  };
}
