# ErrorBoundary.tsx

**File:** `src/shared/components/ErrorBoundary.tsx`
**Purpose:** React class component that catches unhandled render errors in its subtree. Logs the error via the app logger and renders a fallback UI with a reload button.

---

## Exports

### `ErrorBoundary`

**Props:**

```ts
interface Props {
  children: ReactNode;
  fallback?: ReactNode;   // Optional custom fallback UI
}
```

---

## Key behaviors

- **`getDerivedStateFromError`:** Sets `hasError = true` and stores the `error`. Triggers a re-render with the fallback UI.
- **`componentDidCatch`:** Logs the error message, stack trace, and React component stack via `log.error('[ErrorBoundary] uncaught render error', { ... })`.
- **Default fallback:** If no `fallback` prop is provided, renders a centered full-screen panel with:
  - "Algo salió mal" heading.
  - Short explanation message.
  - A "Recargar página" button that calls `window.location.reload()`.
  - Dark theme styling (inline styles matching the app's `#0a0a0f` background).
- **Custom fallback:** If `fallback` is provided, it is rendered directly instead of the default panel.
- **Usage:** `main.tsx` wraps the entire `<App>` in `<ErrorBoundary>` so any uncaught render error shows a recoverable error screen instead of a blank page.
