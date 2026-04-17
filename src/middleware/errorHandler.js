const AppError = require('../utils/AppError');

/**
 * Global Express error handler.
 * Distinguishes operational errors (AppError) from programming bugs.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] ?? 'field';
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`,
      code:    'DUPLICATE_ENTRY',
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'The requested record was not found.',
      code:    'NOT_FOUND',
    });
  }

  // Our own operational errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.code && { code: err.code }),
    });
  }

  // Unexpected programming error — don't leak details in production
  console.error('UNEXPECTED ERROR:', err);

  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred.'
      : err.message,
  });
};

module.exports = errorHandler;
