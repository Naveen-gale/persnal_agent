import { config } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const isProduction = config.env === 'production';

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);

  res.status(statusCode).json({
    error: err.message || 'An unexpected internal server error occurred.',
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
