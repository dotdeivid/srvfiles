import { isTauriApp } from './tauri';

type Meta = Record<string, unknown>;

function fmt(msg: string, meta?: Meta): string {
  return meta ? `${msg} — ${JSON.stringify(meta)}` : msg;
}

// Lazy-load Tauri log to avoid import errors in browser
let tauriLog: typeof import('@tauri-apps/plugin-log') | null = null;
async function getTauriLog() {
  if (!tauriLog) tauriLog = await import('@tauri-apps/plugin-log');
  return tauriLog;
}

export const log = {
  error: async (msg: string, meta?: Meta) => {
    const line = fmt(msg, meta);
    if (isTauriApp()) { (await getTauriLog()).error(line); }
    else { console.error(line); }
  },
  warn: async (msg: string, meta?: Meta) => {
    const line = fmt(msg, meta);
    if (isTauriApp()) { (await getTauriLog()).warn(line); }
    else { console.warn(line); }
  },
  info: async (msg: string, meta?: Meta) => {
    const line = fmt(msg, meta);
    if (isTauriApp()) { (await getTauriLog()).info(line); }
    else { console.info(line); }
  },
  debug: async (msg: string, meta?: Meta) => {
    const line = fmt(msg, meta);
    if (isTauriApp()) { (await getTauriLog()).debug(line); }
    else { console.debug(line); }
  },
};
