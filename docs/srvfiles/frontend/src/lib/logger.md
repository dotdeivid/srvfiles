# logger.ts

**File:** `src/lib/logger.ts`
**Purpose:** Unified logging facade that routes log messages to `@tauri-apps/plugin-log` when running inside Tauri, and to the browser `console` otherwise.

---

## Exports

### `log`

An object with four async methods, one per severity level:

| Method | Signature | Routes to |
|---|---|---|
| `log.error` | `(msg: string, meta?: Record<string, unknown>) => Promise<void>` | `tauriLog.error` / `console.error` |
| `log.warn` | `(msg: string, meta?: Meta) => Promise<void>` | `tauriLog.warn` / `console.warn` |
| `log.info` | `(msg: string, meta?: Meta) => Promise<void>` | `tauriLog.info` / `console.info` |
| `log.debug` | `(msg: string, meta?: Meta) => Promise<void>` | `tauriLog.debug` / `console.debug` |

---

## Key behaviors

- **Format:** Messages are serialized as `"{msg} — {JSON.stringify(meta)}"` when a `meta` object is provided, or just `"{msg}"` otherwise.
- **Lazy Tauri import:** `@tauri-apps/plugin-log` is loaded on demand the first time a log call is made inside Tauri. The module reference is cached in `tauriLog` for subsequent calls, avoiding repeated dynamic imports.
- **Environment detection:** Uses `isTauriApp()` from `lib/tauri` to decide the routing at call time; no build-time tree-shaking is needed.
- **Async interface:** All methods return `Promise<void>` because the Tauri plugin log calls are async. Callers throughout the codebase use `void log.info(...)` (fire-and-forget) to avoid unhandled promise warnings.
