import { createLogger, format, transports } from 'winston';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = createLogger({
  level: isDev ? 'debug' : 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    isDev
      ? format.combine(format.colorize(), format.simple())
      : format.json(),
  ),
  transports: [
    new transports.Console(),
    // 프로덕션: 파일 로그
    ...(isDev ? [] : [
      new transports.File({
        filename: path.join(process.env.APPDATA ?? '.', 'oomni', 'logs', 'error.log'),
        level: 'error',
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3,
      }),
      new transports.File({
        filename: path.join(process.env.APPDATA ?? '.', 'oomni', 'logs', 'combined.log'),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
    ]),
  ],
});
