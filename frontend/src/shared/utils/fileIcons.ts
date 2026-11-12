/**
 * Maps file extensions to emoji icons for display in the file list.
 * Centralized so it can be updated in one place.
 */

const FILE_ICONS: Record<string, string> = {
  // Documents & text
  doc: '📝', docx: '📝', odt: '📝', rtf: '📝', txt: '📝', md: '📝', markdown: '📝', mdx: '📝', rst: '📝', log: '📝', tex: '📝',
  // PDF
  pdf: '📄',
  // Images
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️', bmp: '🖼️', ico: '🖼️', heic: '🖼️', heif: '🖼️', avif: '🖼️', tif: '🖼️', tiff: '🖼️',
  // Video
  mp4: '🎬', avi: '🎬', mkv: '🎬', mov: '🎬', webm: '🎬', m4v: '🎬', '3gp': '🎬', wmv: '🎬',
  // Audio
  mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵', m4a: '🎵', aac: '🎵', opus: '🎵', wma: '🎵',
  // Archives
  zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦', bz2: '📦', xz: '📦', tgz: '📦',
  // Apps & installers
  apk: '💿', aab: '💿', exe: '💿', msi: '💿', dmg: '💿', pkg: '💿', deb: '💿', rpm: '💿', appimage: '💿', iso: '💿',
  // Code
  js: '⚙️', jsx: '⚙️', ts: '⚙️', tsx: '⚙️', py: '⚙️', java: '⚙️', kt: '⚙️', swift: '⚙️', dart: '⚙️', go: '⚙️', rs: '⚙️', c: '⚙️', h: '⚙️', cpp: '⚙️', cs: '⚙️', php: '⚙️', rb: '⚙️', sh: '⚙️', bat: '⚙️', ps1: '⚙️', sql: '⚙️',
  // Web & data
  html: '🌐', htm: '🌐', css: '🌐', json: '🌐', xml: '🌐', yaml: '🌐', yml: '🌐', toml: '🌐', ini: '🌐', env: '🌐',
  // Spreadsheets & presentations
  xlsx: '📊', xls: '📊', ods: '📊', csv: '📊', tsv: '📊', pptx: '📊', ppt: '📊', odp: '📊', key: '📊', numbers: '📊',
};

/** Archivo genérico (antes 📁, que parecía una carpeta). */
const DEFAULT_ICON = '📃';

/**
 * Returns an emoji icon that represents the file type based on its extension.
 * Unrecognized extensions fall back to a generic document emoji.
 *
 * @param filename - The full filename including extension (e.g. `"report.pdf"`).
 * @returns An emoji string matching the file's type, or `"📃"` as the default.
 */
export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || DEFAULT_ICON;
}
