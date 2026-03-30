# ImagePreview.tsx

**File:** `src/features/preview/previews/ImagePreview.tsx`
**Purpose:** Interactive image preview with mouse-drag panning and scroll-wheel zoom. Also handles SVG files.

---

## Exports

### `ImagePreview`

**Props:** `{ src: string; fileName: string }`

---

## Key behaviors

- **Zoom:** Mouse wheel events adjust `scale` state in the range `[0.25, 5]`. Delta is `e.deltaY * 0.001`.
- **Pan:** Mouse down starts a drag by recording `{ mx, my, px, py }` in `dragStart` ref. Mouse move updates `pos` state by computing the delta from drag start. Mouse up and mouse leave end the drag.
- **CSS transform:** The `<img>` uses `transform: translate(${pos.x}px, ${pos.y}px) scale(${scale})` inline style. `userSelect: none` and `pointerEvents: none` prevent text selection and pointer interference during drag.
- **Reset button:** When `scale !== 1`, a "1:1" button appears over the image that resets both `scale` to `1` and `pos` to `{ x: 0, y: 0 }`.
- **Cursor:** The container shows `cursor: grab` normally and `cursor: grabbing` while `dragStart.current` is non-null.
