import { useEffect, useState } from 'react';

interface Props {
  src: string;
}

export function TextPreview({ src }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => { if (!cancelled) setContent(text); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [src]);

  if (error) return <div className="preview-state">No se pudo cargar el archivo.</div>;
  if (content === null) return <div className="preview-state">Cargando…</div>;

  return <pre className="preview-text">{content}</pre>;
}
