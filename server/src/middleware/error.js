import { config } from '../config/env.js';

/** Throw this from any route to send a clean HTTP error to the client. */
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (_req, res) => res.status(404).json({ message: 'Route not found' });

// Centralised error handler: every failure leaves the API in the same shape,
// and stack traces / internals are never sent to clients in production.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  if (err.name === 'ZodError') return res.status(400).json({ message: err.issues[0]?.message || 'Invalid input', field: err.issues[0]?.path?.join('.') });
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return res.status(409).json({ message: field ? `That ${field} is already taken` : 'That value is already taken' });
  }
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors)[0].message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'File is too large' });
  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.name === 'MulterError') return res.status(400).json({ message: 'Too many or unexpected files' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request body too large' });
  const status = err.status || 500;
  if (status >= 500) console.error(err); // log server faults only (never request bodies: they may contain passwords)
  res.status(status).json({ message: status >= 500 && config.isProd ? 'Something went wrong' : err.message });
};
