import type { FileInfo } from './files.api';

export type SortKey = 'newest' | 'oldest' | 'name' | 'size';

export const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Más recientes',
  oldest: 'Más antiguos',
  name: 'Nombre (A–Z)',
  size: 'Más pesados',
};

const byName = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

const time = (f: FileInfo) => {
  const t = Date.parse(f.createdAt);
  return Number.isNaN(t) ? 0 : t;
};

/** Devuelve una copia ordenada. Los empates se resuelven por nombre. */
export function sortFiles(files: FileInfo[], key: SortKey): FileInfo[] {
  const compare: Record<SortKey, (a: FileInfo, b: FileInfo) => number> = {
    newest: (a, b) => time(b) - time(a),
    oldest: (a, b) => time(a) - time(b),
    name: () => 0,
    size: (a, b) => b.size - a.size,
  };
  return [...files].sort((a, b) => compare[key](a, b) || byName.compare(a.name, b.name));
}

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === 'string' && value in SORT_LABELS;
}
