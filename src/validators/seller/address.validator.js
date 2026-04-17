const Joi = require('joi');

const addAddressSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Full name is required.',
  }),

  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone must be a valid 10-digit Indian number.',
      'any.required':        'Phone is required.',
    }),

  pincode: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Pincode must be a 6-digit number.',
      'any.required':        'Pincode is required.',
    }),

  state: Joi.string().trim().min(2).max(60).required().messages({
    'any.required': 'State is required.',
  }),

  city: Joi.string().trim().min(2).max(60).required().messages({
    'any.required': 'City is required.',
  }),

  addressLine: Joi.string().trim().min(5).max(255).required().messages({
    'any.required': 'Address line is required.',
  }),

  landmark: Joi.string().trim().max(100).optional(),

  isDefault: Joi.boolean().default(false),

  type: Joi.string().valid('PICKUP', 'BILLING').default('PICKUP'),
});

const setDefaultAddressSchema = Joi.object({
  addressId: Joi.number().integer().positive().required().messages({
    'any.required': 'Address ID is required.',
  }),
});

module.exports = { addAddressSchema, setDefaultAddressSchema };
