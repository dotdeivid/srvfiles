/**
 * Sanitizes a filename by removing dangerous characters and path traversal attempts.
 * Rejects filenames containing "..", "/" or "\".
 */
export function sanitizeFilename(filename: string): string {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error(`Invalid filename: "${filename}" contains forbidden characters`);
  }

  // Remove non-safe characters (keep alphanumeric, dots, hyphens, underscores, parens, brackets)
  let sanitized = filename.replace(/[^\w\s.\-()[\]]/g, '_');

  // Replace whitespace with underscore
  sanitized = sanitized.replace(/[\s]+/g, '_');

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

  // Fallback name if empty after sanitization
  if (!sanitized) {
    sanitized = `file_${Date.now()}`;
  }

  return sanitized;
}
