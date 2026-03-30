# AudioPreview.tsx

**File:** `src/features/preview/previews/AudioPreview.tsx`
**Purpose:** Preview component for audio files. Renders a native HTML5 `<audio>` player with controls.

---

## Exports

### `AudioPreview`

**Props:** `{ src: string; fileName: string }`

Renders a centered block with a musical note emoji, the file name, and a native `<audio controls>` element pointing to `src` (the `/api/files/preview/` URL).

No state, no effects — purely presentational. Relies on the browser's built-in audio player for playback controls.
