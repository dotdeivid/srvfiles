/** Puerto por defecto del backend SrvFiles (HTTPS = puerto + 1). */
export const DEFAULT_BACKEND_PORT = 3001;

/**
 * Normaliza lo que el usuario escribe como dirección de servidor.
 * Acepta `192.168.1.5`, `192.168.1.5:3001`, `http://host/`, `http://host:3001/ruta`
 * y devuelve `http://host:puerto` sin barra final, o null si no es válida.
 */
export function normalizeServerUrl(input: string): string | null {
  let text = input.trim();
  if (!text) return null;
  if (!/^[a-z]+:\/\//i.test(text)) text = `http://${text}`;
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    const port = url.port || String(DEFAULT_BACKEND_PORT);
    return `${url.protocol}//${url.hostname}:${port}`;
  } catch {
    return null;
  }
}

/** Hostname de una URL, o '' si no se puede parsear. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** true si las dos URLs apuntan al mismo host (comparación exacta, no por subcadena). */
export function sameHost(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ha = hostOf(a);
  return ha !== '' && ha === hostOf(b);
}

/** true si la URL apunta a esta máquina. */
export function isLocalOrigin(baseUrl: string): boolean {
  const h = hostOf(baseUrl);
  return h === 'localhost' || h === '127.0.0.1' || h === 'tauri.localhost';
}

/** URL del backend de otro equipo a partir de su IP y puerto. */
export function serverUrlFor(ip: string, port?: number | null): string {
  return `http://${ip}:${port || DEFAULT_BACKEND_PORT}`;
}
