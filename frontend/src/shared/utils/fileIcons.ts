/**
 * Maps file extensions to emoji icons for display in the file list.
 * Centralized so it can be updated in one place.
 */

const FILE_ICONS: Record<string, string> = {
  // Documents
  pdf: '📄', doc: '📝', docx: '📝', txt: '📝',
  // Images
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
  // Video
  mp4: '🎬', avi: '🎬', mkv: '🎬', mov: '🎬',
  // Audio
  mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵',
  // Archives
  zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦',
  // Code
  js: '⚙️', ts: '⚙️', py: '⚙️', java: '⚙️', cpp: '⚙️',
  // Web
  html: '🌐', css: '🌐', json: '🌐',
  // Spreadsheets & Presentations
  xlsx: '📊', xls: '📊', csv: '📊',
  pptx: '📊', ppt: '📊',
};

const DEFAULT_ICON = '📁';

/**
 * Returns an emoji icon that represents the file type based on its extension.
 * Unrecognized extensions fall back to a generic folder emoji.
 *
 * @param filename - The full filename including extension (e.g. `"report.pdf"`).
 * @returns An emoji string matching the file's type, or `"📁"` as the default.
 */
export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || DEFAULT_ICON;
}
