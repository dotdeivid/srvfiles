import type { DiskStats as DiskStatsType } from './files.api';
import { formatBytes } from '../../shared/utils/format';

interface DiskStatsProps {
  stats: DiskStatsType | null;
}

/**
 * Disk space indicator in the header.
 * Shows used/total with a visual progress bar.
 */
export function DiskStats({ stats }: DiskStatsProps) {
  if (!stats || stats.total <= 0) return null;

  const usedPercent = Math.min(100, Math.round((stats.used / stats.total) * 100));
  const isWarning = usedPercent > 80;
  const isCritical = usedPercent > 95;

  return (
    <div className="disk-stats" id="disk-stats" title={`${usedPercent}% usado`}>
      <div className="disk-stats__bar">
        <div
          className={`disk-stats__fill ${isCritical ? 'disk-stats__fill--critical' : isWarning ? 'disk-stats__fill--warning' : ''}`}
          style={{ width: `${usedPercent}%` }}
        />
      </div>
      <span className="disk-stats__text">
        {formatBytes(stats.free)} libres de {formatBytes(stats.total)}
      </span>
    </div>
  );
}
