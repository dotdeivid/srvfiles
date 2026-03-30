# DiskStats.tsx

**File:** `src/features/files/DiskStats.tsx`
**Purpose:** Disk space indicator rendered in the app header. Displays free/total space with a visual progress bar that changes color at high usage thresholds.

---

## Exports

### `DiskStats`

**Props:**

```ts
interface DiskStatsProps {
  stats: DiskStatsType | null;
}
```

(`DiskStatsType` is `DiskStats` from `files.api.ts` — `{ total, used, free }` in bytes.)

---

## Key behaviors

- **Null guard:** Returns `null` when `stats` is `null` (i.e. while the first fetch is in progress or failed). The header renders nothing in that position until stats are available.
- **Usage percentage:** Calculated as `Math.round((stats.used / stats.total) * 100)`.
- **Color thresholds:**
  - `> 95%` → `disk-stats__fill--critical` (red)
  - `> 80%` → `disk-stats__fill--warning` (amber)
  - Otherwise → default (blue/indigo)
- **Display:** Shows `"{free} / {total}"` using `formatBytes` from `shared/utils/format`.
- **ID:** The root `<div>` has `id="disk-stats"` for E2E test targeting.
