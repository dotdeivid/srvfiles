import { useState, useEffect, useCallback, useMemo } from 'react';
import { createFilesApi, getApiUrl, type FileInfo, type DiskStats, type AppConfig } from './files.api';
import { log } from '../../lib/logger';

// ─── Hook return type ───────────────────────────────────────────────
interface UseFilesReturn {
  files: FileInfo[];
  stats: DiskStats | null;
  config: AppConfig | null;
  loading: boolean;
  uploading: boolean;
  uploadProgress: number;
  error: string | null;
  fetchFiles: () => Promise<void>;
  fetchStats: () => Promise<void>;
  upload: (files: File[]) => Promise<boolean>;
  remove: (filename: string) => Promise<boolean>;
  getDownloadUrl: (filename: string) => string;
}

/**
 * Manages all file-related state for a given server URL.
 *
 * On mount, fetches the file list, disk stats, and app config in parallel.
 * Then polls the file list and disk stats every {@link POLL_INTERVAL} ms.
 * Re-initializes automatically whenever `serverUrl` changes.
 *
 * @param serverUrl - Optional backend base URL. Defaults to the auto-detected local URL.
 * @returns An object containing file state, upload/delete actions, and polling controls.
 */
export function useFiles(serverUrl?: string | null): UseFilesReturn {
  const api = useMemo(
    () => createFilesApi(serverUrl ?? getApiUrl()),
    [serverUrl]
  );

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [stats, setStats] = useState<DiskStats | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch file list ────────────────────────────────────────────

  /**
   * Fetches the current file list from the server and updates state.
   * Sets `error` on failure; clears it on success.
   */
  const fetchFileList = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getFiles();
      void log.debug('[useFiles] file list fetched', { count: data.files.length });
      setFiles(data.files);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch files';
      setError(message);
      void log.error('[useFiles] fetch files failed', { error: String(err) });
    }
  }, [api]);

  // ─── Fetch disk stats ──────────────────────────────────────────

  /**
   * Fetches disk usage statistics and updates `stats` state.
   * Errors are logged but not surfaced to the UI (non-critical).
   */
  const fetchDiskStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      void log.warn('[useFiles] fetch disk stats failed', { error: String(err) });
    }
  }, [api]);

  // ─── Fetch config ──────────────────────────────────────────────

  /**
   * Fetches the server's runtime config (app name, LAN IP, ports) once on mount.
   * Errors are logged but not surfaced to the UI.
   */
  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.getConfig();
      void log.debug('[useFiles] config fetched', { appName: data.appName, lanIp: data.lanIp });
      setConfig(data);
    } catch (err) {
      void log.warn('[useFiles] fetch config failed', { error: String(err) });
    }
  }, [api]);

  // ─── Upload files ──────────────────────────────────────────────

  /**
   * Uploads one or more files to the server, tracking progress.
   * Refreshes the file list and disk stats on success.
   *
   * @param filesToUpload - Array of `File` objects to upload.
   * @returns `true` if all files were uploaded successfully, `false` on error.
   */
  const uploadFile = useCallback(async (filesToUpload: File[]): Promise<boolean> => {
    void log.info('[useFiles] uploading files', { count: filesToUpload.length, names: filesToUpload.map((f) => f.name) });
    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      await api.uploadFiles(filesToUpload, (progress) => {
        setUploadProgress(progress);
      });

      void log.info('[useFiles] upload complete');
      await Promise.all([fetchFileList(), fetchDiskStats()]);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload files';
      setError(message);
      void log.error('[useFiles] upload failed', { error: String(err) });
      return false;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [api, fetchFileList, fetchDiskStats]);

  // ─── Delete file ───────────────────────────────────────────────

  /**
   * Permanently deletes a file from the server by name.
   * Refreshes the file list and disk stats on success.
   *
   * @param filename - The exact filename to delete.
   * @returns `true` if the file was deleted, `false` on error.
   */
  const removeFile = useCallback(async (filename: string): Promise<boolean> => {
    void log.info('[useFiles] deleting file', { filename });
    try {
      setError(null);
      await api.deleteFile(filename);
      void log.info('[useFiles] file deleted', { filename });
      await Promise.all([fetchFileList(), fetchDiskStats()]);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete file';
      setError(message);
      void log.error('[useFiles] delete failed', { filename, error: String(err) });
      return false;
    }
  }, [api, fetchFileList, fetchDiskStats]);

  // ─── Initial fetch ─────────────────────────────────────────────
  useEffect(() => {
    // serverUrl === null means paused (e.g. PIN dialog is open) — do nothing
    if (serverUrl === null) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setFiles([]);
    setStats(null);
    setConfig(null);

    const init = async () => {
      await Promise.all([fetchFileList(), fetchDiskStats(), fetchConfig()]);
      setLoading(false);
    };
    init();
  }, [serverUrl, fetchFileList, fetchDiskStats, fetchConfig]);

  return {
    files,
    stats,
    config,
    loading,
    uploading,
    uploadProgress,
    error,
    fetchFiles: fetchFileList,
    fetchStats: fetchDiskStats,
    upload: uploadFile,
    remove: removeFile,
    getDownloadUrl: api.getDownloadUrl,
  };
}
