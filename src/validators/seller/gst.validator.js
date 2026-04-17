const Joi = require('joi');

/**
 * GSTIN format: 2-digit state code + 10-char PAN + 1-digit entity + Z + checksum
 * Example: 27AAPFU0939F1ZV
 */
const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const submitGstSchema = Joi.object({
  hasGstin: Joi.boolean().required().messages({
    'any.required': 'hasGstin flag is required.',
  }),

  // Required only when hasGstin = true
  gstin: Joi.when('hasGstin', {
    is:        true,
    then:      Joi.string().uppercase().pattern(gstinPattern).required().messages({
      'string.pattern.base': 'Invalid GSTIN format.',
      'any.required':        'GSTIN is required when hasGstin is true.',
    }),
    otherwise: Joi.forbidden(),
  }),

  businessName: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Business name is required.',
  }),

  panNumber: Joi.string()
    .uppercase()
    .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid PAN format. Expected: ABCDE1234F',
      'any.required':        'PAN number is required.',
    }),

  businessType: Joi.string()
    .valid('MANUFACTURER', 'RESELLER', 'WHOLESALER')
    .required()
    .messages({
      'any.only':     'Business type must be MANUFACTURER, RESELLER, or WHOLESALER.',
      'any.required': 'Business type is required.',
    }),
});

module.exports = { submitGstSchema };
