/**
 * Standardised API response helpers.
 * All responses follow the shape:
 *   { success, message, data?, nextStep?, meta? }
 */

/**
 * Recursively removes sensitive fields from an object or array.
 */
const stripSensitive = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  // Handle Date objects
  if (obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    return obj.map(stripSensitive);
  }

  const sensitiveFields = ['password', 'passwordHash', 'OTP', 'otp'];
  const newObj = {};

  Object.keys(obj).forEach((key) => {
    if (sensitiveFields.includes(key)) return;
    newObj[key] = stripSensitive(obj[key]);
  });

  return newObj;
};

const success = (res, message, data = null, statusCode = 200, extras = {}) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = stripSensitive(data);
  if (extras.nextStep) payload.nextStep = extras.nextStep;
  if (extras.meta) payload.meta = extras.meta;
  return res.status(statusCode).json(payload);
};

const created = (res, message, data = null, extras = {}) =>
  success(res, message, data, 201, extras);

const error = (res, message, statusCode = 500, code = null) =>
  res.status(statusCode).json({ success: false, message, ...(code && { code }) });

/**
 * Formats a Joi ValidationError into a 422 response.
 */
const validationError = (res, joiError) => {
  const details = joiError.details.map((d) => d.message);
  return res.status(422).json({ success: false, message: 'Validation failed.', errors: details });
};

module.exports = { success, created, error, validationError };
