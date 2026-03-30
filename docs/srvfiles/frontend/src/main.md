# main.tsx

**File:** `src/main.tsx`
**Purpose:** Application entry point. Mounts the React tree into the DOM root, wraps the app in `ErrorBoundary`, and logs the startup event.

---

## Key behaviors

- **Startup log:** `void log.info('[main] SrvFiles frontend starting')` is called before `createRoot`, recording the startup in the Tauri log file or browser console.
- **Error boundary:** The entire `<App />` is wrapped in `<ErrorBoundary>` so any uncaught render error shows a recovery screen instead of a blank page.
- **Strict mode:** `<StrictMode>` wraps the tree in development, enabling double-invoke checks for side effects.
- **CSS import:** `'./styles/index.css'` is the single global stylesheet entry point.
- **Mount target:** `document.getElementById('root')!` — the `<div id="root">` in `index.html`.
