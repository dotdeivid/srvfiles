import { useRef, useState } from 'react';

interface Props {
  src: string;
  fileName: string;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const clamp = (s: number) => Math.min(Math.max(MIN_SCALE, s), MAX_SCALE);

/**
 * Imagen con zoom y arrastre. Usa Pointer Events: funciona con mouse, lápiz
 * y táctil (arrastrar con un dedo, pellizcar con dos, doble toque = 1:1).
 */
export function ImagePreview({ src, fileName }: Props) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; x: number; y: number; px: number; py: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const resetZoom = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  const handleWheel = (e: React.WheelEvent) => {
    setScale((s) => clamp(s - e.deltaY * 0.001));
  };

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      gesture.current = { dist: 0, scale, x: pts[0].x, y: pts[0].y, px: pos.x, py: pos.y };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale, x: 0, y: 0, px: pos.x, py: pos.y };
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
    startGesture();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length >= 2 && g.dist > 0) {
      const [a, b] = pts;
      setScale(clamp(g.scale * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist)));
    } else if (pts.length === 1) {
      setPos({ x: g.px + pts[0].x - g.x, y: g.py + pts[0].y - g.y });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setDragging(false);
      gesture.current = null;
    } else {
      startGesture();
    }
  };

  return (
    <div
      className="preview-image-wrap"
      onWheel={handleWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={resetZoom}
      style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      <img
        src={src}
        alt={fileName}
        className="preview-image"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
      {scale !== 1 && (
        <button className="preview-zoom-reset" onClick={resetZoom} title="Restablecer zoom">
          1:1
        </button>
      )}
    </div>
  );
}
