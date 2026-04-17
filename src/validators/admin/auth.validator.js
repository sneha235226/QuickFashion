const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'A valid email address is required.',
    'any.required': 'Email is required.',
  }),
  password: Joi.string().min(6).required().messages({
    'any.required': 'Password is required.',
  }),
});

const registerSchema = Joi.object({
  username: Joi.string().trim().min(3).max(30).required(),
  email:    Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters.',
  }),
  secretKey: Joi.string().required().messages({
    'any.required': 'Admin secret key is required.',
  }),
});

module.exports = { loginSchema, registerSchema };
