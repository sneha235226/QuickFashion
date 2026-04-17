const Joi = require('joi');

const createProfileSchema = Joi.object({
  storeName: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Store name is required.',
  }),

  category: Joi.string()
    .valid(
      'FASHION',
      'ELECTRONICS',
      'HOME_DECOR',
      'BEAUTY',
      'SPORTS',
      'BOOKS',
      'TOYS',
      'GROCERY',
      'OTHER'
    )
    .required()
    .messages({
      'any.only':     'Invalid category.',
      'any.required': 'Category is required.',
    }),

  businessType: Joi.string()
    .valid('MANUFACTURER', 'RESELLER', 'WHOLESALER')
    .required()
    .messages({
      'any.only':     'Business type must be MANUFACTURER, RESELLER, or WHOLESALER.',
      'any.required': 'Business type is required.',
    }),

  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'A valid email address is required.',
    'any.required': 'Email is required.',
  }),

  alternatePhone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Alternate phone must be a valid 10-digit Indian number.',
    }),
});

module.exports = { createProfileSchema };
