export function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const timeFmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const fullFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Fecha corta para la lista de archivos: "hoy 14:05", "ayer 09:12",
 * "13 nov" (este año) o "13 nov 2025". Vacío si la fecha no es válida.
 */
export function formatDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = date.getTime();
  if (t >= startOfToday) return `hoy ${timeFmt.format(date)}`;
  if (t >= startOfToday - 86_400_000) return `ayer ${timeFmt.format(date)}`;
  return date.getFullYear() === now.getFullYear() ? dayFmt.format(date) : fullFmt.format(date);
}
