import { createLogger, format, transports } from 'winston';
import { join } from 'path';
import { mkdirSync } from 'fs';

const logsDir = join(process.cwd(), 'logs');
mkdirSync(logsDir, { recursive: true });

const isDev = process.env.NODE_ENV !== 'production';

const lineFormat = format.printf(({ level, message, source, ...meta }) => {
  const ts  = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lvl = level.toUpperCase().padEnd(5);
  const src = source ? `[${source}] ` : '';
  const keys = Object.keys(meta).filter((k) => k !== 'splat');
  const ctx = keys.length ? ` — ${JSON.stringify(meta)}` : '';
  return `${ts} ${lvl} ${src}${message}${ctx}`;
});

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

export const log = {
  error: (source: string, message: string, meta?: object) =>
    logger.error(message, { source, ...meta }),
  warn: (source: string, message: string, meta?: object) =>
    logger.warn(message, { source, ...meta }),
  info: (source: string, message: string, meta?: object) =>
    logger.info(message, { source, ...meta }),
  debug: (source: string, message: string, meta?: object) =>
    logger.debug(message, { source, ...meta }),
};
