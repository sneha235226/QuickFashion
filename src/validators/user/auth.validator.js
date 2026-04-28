const Joi = require('joi');

const registerSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().required(),
    mobile: Joi.string().required(),
    password: Joi.string().min(6).required(),
});

const sendOtpSchema = Joi.object({
    mobile: Joi.string().required().messages({
        'any.required': 'Mobile number is required.',
    }),
});

const verifyOtpSchema = Joi.object({
    mobile: Joi.string().required(),
    otp: Joi.alternatives().try(
        Joi.string().pattern(/^\d{4,6}$/),
        Joi.number().integer().min(1000).max(999999)
    ).required().messages({
        'alternatives.types': 'OTP must be a 4-6 digit number or string.',
        'any.required': 'OTP is required.',
    }),
    requestId: Joi.string().optional(),
});

const loginSchema = Joi.object({
    identifier: Joi.alternatives().try(
        Joi.string().email(),
        Joi.string().pattern(/^\d{10,15}$/)
    ).required().messages({
        'alternatives.types': 'Identifier must be a valid email or phone number.',
        'any.required': 'Identifier (email or phone) is required.'
    }),
    password: Joi.string().required().messages({
        'any.required': 'Password is required.'
    }),
});

module.exports = {
    registerSchema,
    sendOtpSchema,
    verifyOtpSchema,
    loginSchema,
};
