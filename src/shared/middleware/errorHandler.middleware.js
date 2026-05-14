import winston from 'winston';

// Assuming you already have a configured logger exported from somewhere
// (recommended approach)
import { logger } from '../../config/logger.js';

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Programmer error: log full stack and return generic message
  logger.error('Unexpected error', {
    err: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    requestId: req.id,
    // You can add more context if needed
  });

  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
};

export default errorHandler;