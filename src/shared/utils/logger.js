import winston from 'winston';
import path from 'path';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-assistant' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0) msg += ` ${JSON.stringify(metadata)}`;
          return msg;
        })
      ),
    }),
  ],
});

if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({ 
    filename: path.join(process.cwd(), 'logs', 'error.log'), 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: path.join(process.cwd(), 'logs', 'combined.log') 
  }));
}

export default logger;