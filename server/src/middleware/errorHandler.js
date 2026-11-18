import multer from 'multer';
import { AppError } from '../utils/AppError.js';
import { config } from '../config.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `File is too large. Maximum size is ${config.limits.maxBytesPerPdf / (1024 * 1024)} MB per PDF.`,
      LIMIT_FILE_COUNT: 'Please upload one file at a time.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field. Use the field name "file".',
    };
    return res.status(400).json({
      error: { code: err.code, message: messages[err.code] || 'File upload failed.' },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
  }

  console.error('[unhandled]', err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side.' } });
}
