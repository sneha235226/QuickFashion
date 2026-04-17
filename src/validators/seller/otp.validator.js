const Joi = require('joi');

const mobileSchema = Joi.string()
  .pattern(/^[6-9]\d{9}$/)
  .required()
  .messages({
    'string.pattern.base': 'Mobile number must be a valid 10-digit Indian mobile number.',
    'any.required': 'Mobile number is required.',
  });

const sendOtpSchema = Joi.object({
  mobile: mobileSchema,
});

const verifyOtpSchema = Joi.object({
  mobile: mobileSchema,
  otp: Joi.string()
    .min(4)
    .max(6)
    .pattern(/^\d{4,6}$/)
    .required()
    .messages({
      'string.min': 'OTP must be between 4 and 6 digits.',
      'string.max': 'OTP must be between 4 and 6 digits.',
      'string.pattern.base': 'OTP must contain only digits.',
      'any.required': 'OTP is required.',
    }),
  requestId: Joi.string().optional(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required.',
  }),
});

module.exports = { sendOtpSchema, verifyOtpSchema, refreshTokenSchema };
