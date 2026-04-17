const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

/**
 * OTP send rate limiter:
 *   Max 3 OTP requests per mobile per hour.
 *   Keyed by mobile number when present, falls back to normalised IP.
 */
const otpSendLimiter = rateLimit({
  windowMs: 20 * 1000, // 20 seconds for testing
  max: 10,
  keyGenerator: (req) => req.body?.mobile ?? ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again after 20 seconds.',
    code: 'OTP_RATE_LIMITED',
  },
});

/**
 * General auth limiter:
 *   Max 10 requests per IP per 15 minutes (for login / refresh endpoints).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
    code: 'AUTH_RATE_LIMITED',
  },
});

module.exports = { otpSendLimiter, authLimiter };
