import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createFilesApi, getApiUrl, type FileInfo, type DiskStats, type AppConfig } from '../api/files.api';

// ─── Polling interval (ms) ──────────────────────────────────────────
const POLL_INTERVAL = 5000;

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
 * Custom hook that manages all file operations state.
 * Accepts an optional serverUrl to talk to a specific server (remote or local).
 * Handles fetching, uploading, deleting, disk stats, and auto-polling.
 */
export function useFiles(serverUrl?: string): UseFilesReturn {
  const api = useMemo(
    () => createFilesApi(serverUrl || getApiUrl()),
    [serverUrl]
  );

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [stats, setStats] = useState<DiskStats | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch file list ────────────────────────────────────────────
  const fetchFileList = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getFiles();
      setFiles(data.files);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch files';
      setError(message);
      console.error('Fetch files error:', err);
    }
  }, [api]);

  // ─── Fetch disk stats ──────────────────────────────────────────
  const fetchDiskStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  }, [api]);

  // ─── Fetch config ──────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.getConfig();
      setConfig(data);
    } catch (err) {
      console.error('Fetch config error:', err);
    }
  }, [api]);

  // ─── Upload files ──────────────────────────────────────────────
  const uploadFile = useCallback(async (filesToUpload: File[]): Promise<boolean> => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      await api.uploadFiles(filesToUpload, (progress) => {
        setUploadProgress(progress);
      });

      await Promise.all([fetchFileList(), fetchDiskStats()]);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload files';
      setError(message);
      console.error('Upload error:', err);
      return false;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [api, fetchFileList, fetchDiskStats]);

  // ─── Delete file ───────────────────────────────────────────────
  const removeFile = useCallback(async (filename: string): Promise<boolean> => {
    try {
      setError(null);
      await api.deleteFile(filename);
      await Promise.all([fetchFileList(), fetchDiskStats()]);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete file';
      setError(message);
      console.error('Delete error:', err);
      return false;
    }
  }, [api, fetchFileList, fetchDiskStats]);

  // ─── Initial fetch + polling ───────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setFiles([]);
    setStats(null);
    setConfig(null);

    const init = async () => {
      await Promise.all([fetchFileList(), fetchDiskStats(), fetchConfig()]);
      setLoading(false);
    };
    init();

    pollRef.current = setInterval(() => {
      fetchFileList();
      fetchDiskStats();
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchFileList, fetchDiskStats, fetchConfig]);

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
