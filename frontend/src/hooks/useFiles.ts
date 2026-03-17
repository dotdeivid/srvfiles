import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getFiles,
  uploadFiles,
  deleteFile,
  getStats,
  getConfig,
  type FileInfo,
  type DiskStats,
  type AppConfig,
} from '../api/files.api';

// ─── Polling interval (ms) ──────────────────────────────────────────
const POLL_INTERVAL = 5000; // Refresh file list every 5 seconds

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
}

/**
 * Custom hook that manages all file operations state.
 * Handles fetching, uploading, deleting, disk stats, and auto-polling.
 */
export function useFiles(): UseFilesReturn {
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
      const data = await getFiles();
      setFiles(data.files);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch files';
      setError(message);
      console.error('Fetch files error:', err);
    }
  }, []);

  // ─── Fetch disk stats ──────────────────────────────────────────
  const fetchDiskStats = useCallback(async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  }, []);

  // ─── Fetch config ─────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    try {
      const data = await getConfig();
      setConfig(data);
    } catch (err) {
      console.error('Fetch config error:', err);
    }
  }, []);

  // ─── Upload files ──────────────────────────────────────────────
  const uploadFile = useCallback(async (filesToUpload: File[]): Promise<boolean> => {
    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      await uploadFiles(filesToUpload, (progress) => {
        setUploadProgress(progress);
      });

      // Refresh list and stats after upload
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
  }, [fetchFileList, fetchDiskStats]);

  // ─── Delete file ───────────────────────────────────────────────
  const removeFile = useCallback(async (filename: string): Promise<boolean> => {
    try {
      setError(null);
      await deleteFile(filename);

      // Refresh list and stats after delete
      await Promise.all([fetchFileList(), fetchDiskStats()]);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete file';
      setError(message);
      console.error('Delete error:', err);
      return false;
    }
  }, [fetchFileList, fetchDiskStats]);

  // ─── Initial fetch + polling ───────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchFileList(), fetchDiskStats(), fetchConfig()]);
      setLoading(false);
    };
    init();

    // Auto-poll for file list updates (so other devices see changes)
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
  };
}
