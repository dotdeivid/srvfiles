import { useEffect, useState } from 'react';

interface Props {
  src: string;
  onDownload: () => void;
}

/** Se muestran como mucho los primeros 512 KB: un <pre> con cientos de MB congela la pestaña. */
const MAX_PREVIEW_BYTES = 512 * 1024;

export function TextPreview({ src, onDownload }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        // El servidor soporta Range: pedir solo el principio del archivo.
        const res = await fetch(src, {
          headers: { Range: `bytes=0-${MAX_PREVIEW_BYTES - 1}` },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const total = Number(res.headers.get('Content-Range')?.split('/')[1] ?? NaN);
        const buf = await res.arrayBuffer();
        const slice = buf.byteLength > MAX_PREVIEW_BYTES ? buf.slice(0, MAX_PREVIEW_BYTES) : buf;
        setContent(new TextDecoder('utf-8', { fatal: false }).decode(slice));
        setTruncated(buf.byteLength > MAX_PREVIEW_BYTES || (Number.isFinite(total) && total > MAX_PREVIEW_BYTES));
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    })();
    return () => controller.abort();
  }, [src]);

  if (error) return <div className="preview-state">No se pudo cargar el archivo.</div>;
  if (content === null) return <div className="preview-state">Cargando…</div>;

  return (
    <div className="preview-text-wrap">
      {truncated && (
        <p className="preview-state">
          Vista parcial: se muestran los primeros 512 KB.{' '}
          <button className="btn btn--ghost btn--sm" onClick={onDownload}>Descargar completo</button>
        </p>
      )}
      <pre className="preview-text">{content}</pre>
    </div>
  );
}
