import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Custom colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Format for console logs
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    ({ timestamp, level, message, stack, ...meta }) => {
      let log = `${timestamp} [${level}]: ${message}`;
      if (stack) {
        log += `\n${stack}`;
      }
      if (Object.keys(meta).length > 0) {
        log += `\n${JSON.stringify(meta, null, 2)}`;
      }
      return log;
    }
  )
);

// Create the logger
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,

  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),

  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // Error file transport
    new winston.transports.File({
      filename: join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Combined log file
    new winston.transports.File({
      filename: join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add a stream for Morgan (if you're using it)
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

export default logger;