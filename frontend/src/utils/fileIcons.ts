/**
 * Maps file extensions to emoji icons.
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

/** Returns an emoji icon for a given filename based on its extension. */
export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || DEFAULT_ICON;
}
