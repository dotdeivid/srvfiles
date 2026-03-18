/**
 * Formatting utilities for the frontend.
 * Extracted from components to avoid duplication and respect SRP.
 */

/**
 * Converts a raw byte count into a human-readable string with the appropriate unit.
 * Uses base-1024 (binary) prefixes.
 *
 * @param bytes - Non-negative number of bytes.
 * @returns Formatted string such as `"0 B"`, `"1.5 KB"`, `"250 MB"`, or `"1.2 GB"`.
 *
 * @example
 * formatBytes(0)          // "0 B"
 * formatBytes(1536)       // "1.5 KB"
 * formatBytes(1073741824) // "1 GB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Formats an ISO 8601 date string into a short, locale-aware date-time string
 * using the `es-ES` locale (e.g. `"17 mar 2026, 01:30"`).
 *
 * @param dateStr - A valid ISO 8601 date string (e.g. `"2026-03-17T01:30:00.000Z"`).
 * @returns A human-readable date-time string formatted for the `es-ES` locale.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
