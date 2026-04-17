const Joi = require('joi');

const addBankSchema = Joi.object({
  accountHolderName: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Account holder name is required.',
  }),

  accountNumber: Joi.string()
    .pattern(/^\d{9,18}$/)
    .required()
    .messages({
      'string.pattern.base': 'Account number must be 9–18 digits.',
      'any.required':        'Account number is required.',
    }),

  ifsc: Joi.string()
    .uppercase()
    .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid IFSC code format.',
      'any.required':        'IFSC code is required.',
    }),
});

module.exports = { addBankSchema };
