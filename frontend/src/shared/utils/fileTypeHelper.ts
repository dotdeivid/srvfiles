export type FileCategory = 'image' | 'svg' | 'video' | 'audio' | 'pdf' | 'text' | 'unknown';

const EXTENSIONS: Partial<Record<FileCategory, string[]>> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico'],
  svg:   ['svg'],
  video: ['mp4', 'mov', 'm4v', 'webm'],
  audio: ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'opus'],
  pdf:   ['pdf'],
  text:  [
    'txt', 'md', 'json', 'xml', 'csv', 'yaml', 'yml',
    'html', 'htm', 'js', 'jsx', 'ts', 'tsx', 'dart',
    'py', 'go', 'rs', 'swift', 'kt', 'java',
    'c', 'cpp', 'h', 'css', 'sh', 'bash', 'zsh',
  ],
};

export function getFileCategory(filename: string): FileCategory {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  for (const [cat, exts] of Object.entries(EXTENSIONS) as [FileCategory, string[]][]) {
    if (exts.includes(ext)) return cat;
  }
  return 'unknown';
}

export function canPreview(filename: string): boolean {
  return getFileCategory(filename) !== 'unknown';
}
