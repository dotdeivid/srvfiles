import { useRef, useState } from 'react';

interface Props {
  src: string;
  fileName: string;
}

export function ImagePreview({ src, fileName }: Props) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(Math.max(0.25, s - e.deltaY * 0.001), 5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    setPos({
      x: dragStart.current.px + e.clientX - dragStart.current.mx,
      y: dragStart.current.py + e.clientY - dragStart.current.my,
    });
  };

  const endDrag = () => { dragStart.current = null; };

  const resetZoom = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  return (
    <div
      className="preview-image-wrap"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      style={{ cursor: dragStart.current ? 'grabbing' : 'grab' }}
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
