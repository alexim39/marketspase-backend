import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'Too many webhook requests',
});

export const publicLeadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many submissions. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const messageSendLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 3,
  message: { success: false, message: 'Sending too fast. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});