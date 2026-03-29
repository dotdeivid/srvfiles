/**
 * Sanitizes a filename to prevent path traversal attacks and filesystem errors.
 *
 * Rejects any filename containing `..`, `/`, or `\`. Then strips non-safe
 * characters, collapses whitespace to underscores, and trims leading/trailing
 * dots. Falls back to a timestamp-based name if the result is empty.
 *
 * @param filename - The raw filename received from the client.
 * @returns A safe, filesystem-friendly filename.
 * @throws {Error} If the filename contains path traversal sequences.
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
