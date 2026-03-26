export function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

export function extractIp(url: string): string {
  return stripProtocol(url).replace(/:\d+$/, '');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
