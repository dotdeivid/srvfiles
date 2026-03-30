# VideoPreview.tsx

**File:** `src/features/preview/previews/VideoPreview.tsx`
**Purpose:** Preview component for video files. Renders a native HTML5 `<video>` player with controls.

---

## Exports

### `VideoPreview`

**Props:** `{ src: string }`

Renders a `.preview-media-wrap` container with a `<video src={src} controls className="preview-video">` element. No state, no effects — purely presentational. Relies on the browser's built-in video player.
