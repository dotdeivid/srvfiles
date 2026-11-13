import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Copia texto. navigator.clipboard no existe en HTTP sin contexto seguro. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // probar la alternativa
  }
  // Con un diálogo modal abierto el resto de la página es inerte: el textarea
  // tiene que ir dentro del diálogo para poder seleccionarse.
  const host = document.activeElement?.closest('dialog') ?? document.body;
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  host.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  host.removeChild(area);
  return ok;
}

/** Botón de copiar con confirmación (✓) durante 2 s. */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  async function handleCopy() {
    if (!(await copyText(text))) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setCopied(true);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button className="copy-btn" onClick={handleCopy} title="Copiar" aria-label={copied ? 'Copiado' : `Copiar ${text}`}>
      {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} />}
    </button>
  );
}
