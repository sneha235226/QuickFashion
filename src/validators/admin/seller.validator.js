const Joi = require('joi');

const rejectSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(500).required().messages({
    'any.required': 'Rejection reason is required.',
    'string.min':   'Rejection reason must be at least 10 characters.',
  }),
});

const suspendSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(500).required().messages({
    'any.required': 'Suspension reason is required.',
  }),
});

module.exports = { rejectSchema, suspendSchema };
