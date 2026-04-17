const AppError = require('../utils/AppError');

/**
 * Returns an Express middleware that validates req.body against a Joi schema.
 * On failure it throws an AppError with a 422 status so the global error
 * handler picks it up cleanly.
 *
 * @param {import('joi').ObjectSchema} schema
 */
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly:     false, // collect ALL validation errors at once
    stripUnknown:   true,  // remove fields not in schema
    convert:        true,  // coerce types (e.g. string → number)
  });

  if (error) {
    const message = error.details.map((d) => d.message).join('; ');
    return next(new AppError(message, 422, 'VALIDATION_ERROR'));
  }

  req.body = value; // use the sanitized & coerced value
  next();
};

module.exports = validate;
