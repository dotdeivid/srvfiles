# logger.ts

**Archivo:** `src/lib/logger.ts`
**Rol:** Configura el sistema de logging basado en Winston y exporta el objeto `log` que usan todos los demás módulos del backend.

---

## Configuración

```ts
const logsDir = join(process.cwd(), 'logs');
mkdirSync(logsDir, { recursive: true });

const isDev = process.env.NODE_ENV !== 'production';
```

El directorio `logs/` se crea al importar el módulo (al arrancar el servidor). En desarrollo (`NODE_ENV !== 'production'`), los logs también se imprimen en consola.

---

## Formato de línea

```ts
const lineFormat = format.printf(({ level, message, source, ...meta }) => {
  const ts  = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lvl = level.toUpperCase().padEnd(5);
  const src = source ? `[${source}] ` : '';
  const keys = Object.keys(meta).filter((k) => k !== 'splat');
  const ctx = keys.length ? ` — ${JSON.stringify(meta)}` : '';
  return `${ts} ${lvl} ${src}${message}${ctx}`;
});
```

Produce líneas con el formato:
```
2026-03-29 14:30:00 INFO  [auth.service.ts] Auth successful, session created — {"ip":"192.168.1.5"}
```

- `ts`: timestamp local sin milisegundos.
- `lvl`: nivel en mayúsculas, alineado a 5 caracteres.
- `src`: nombre del archivo fuente entre corchetes (el primer argumento de cada función `log.*`).
- `ctx`: contexto adicional serializado como JSON al final de la línea.

---

## Transports

```ts
const logger = createLogger({
  format: format.combine(format.errors({ stack: false }), lineFormat),
  transports: [
    new transports.File({
      filename: join(logsDir, 'errors.txt'),
      level: 'warn',
    }),
    ...(isDev ? [new transports.Console({ level: 'debug' })] : []),
  ],
});
```

- **`errors.txt`**: archivo de log persistente. Solo guarda mensajes de nivel `warn` o superior (`warn`, `error`). Ubicación: `{cwd}/logs/errors.txt`.
- **Console** (solo en dev): imprime todos los niveles hasta `debug`. No se activa en producción para no contaminar stdout del proceso en Tauri.

---

## API exportada

```ts
export const log = {
  error: (source: string, message: string, meta?: object) => logger.error(message, { source, ...meta }),
  warn:  (source: string, message: string, meta?: object) => logger.warn(message,  { source, ...meta }),
  info:  (source: string, message: string, meta?: object) => logger.info(message,  { source, ...meta }),
  debug: (source: string, message: string, meta?: object) => logger.debug(message, { source, ...meta }),
};
```

Cada función acepta:
1. `source`: nombre del archivo que llama (convención: `'auth.service.ts'`). Aparece como `[source]` en el log.
2. `message`: texto descriptivo del evento.
3. `meta` (opcional): objeto con contexto adicional (IPs, nombres de archivo, contadores, etc.).

### Uso típico

```ts
log.info('files.service.ts', 'File deleted', { filename });
log.warn('auth.service.ts', 'IP blocked', { ip, attempts: entry.count });
log.error('cert.ts', 'Error al generar certificado', { error: String(err) });
```
