# TextPreview.tsx

**File:** `src/features/preview/previews/TextPreview.tsx`
**Purpose:** Preview component for plain-text and code files. Fetches the file content via `fetch` and renders it in a `<pre>` block.

---

## Exports

### `TextPreview`

**Props:** `{ src: string }`

---

## Key behaviors

- **Fetch on mount:** A `useEffect` fetches `src`, reads the response as text, and sets `content` state. A `cancelled` flag prevents state updates if the component unmounts before the fetch completes.
- **Error state:** If the fetch fails or returns a non-ok status, `error` is set to `true` and "No se pudo cargar el archivo." is displayed.
- **Loading state:** While `content === null` (and no error), "Cargando…" is shown.
- **Render:** On success, the text is rendered in a `<pre className="preview-text">` element, preserving whitespace and line breaks for code and structured text.
- **Re-fetch:** The `useEffect` depends on `src`, so the content is re-fetched if the preview URL changes.
