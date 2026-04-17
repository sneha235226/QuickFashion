const authService = require('../services/auth.service');
const response = require('../utils/response');
const Joi = require('joi');

const sendOtpSchema = Joi.object({
    mobileNumber: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
        'string.pattern.base': 'Mobile number must be 10 digits.',
    }),
    role: Joi.string().valid('USER', 'SELLER').required(),
});

const verifyOtpSchema = Joi.object({
    mobileNumber: Joi.string().pattern(/^[0-9]{10}$/).required(),
    otp: Joi.string().min(4).max(6).required(),
    role: Joi.string().valid('USER', 'SELLER').required(),
    requestId: Joi.string().required(),
});

const sendOtp = async (req, res, next) => {
    try {
        const { error, value } = sendOtpSchema.validate(req.body);
        if (error) return response.validationError(res, error);

        const { requestId } = await authService.sendOtp(value.mobileNumber, value.role);
        return response.success(res, `OTP sent to ${value.mobileNumber}.`, { requestId });
    } catch (err) {
        next(err);
    }
};

const verifyOtp = async (req, res, next) => {
    try {
        const { error, value } = verifyOtpSchema.validate(req.body);
        if (error) return response.validationError(res, error);

        const tokens = await authService.verifyOtp(
            value.mobileNumber,
            value.otp,
            value.role,
            value.requestId
        );

        return response.success(res, 'OTP verified successfully.', tokens);
    } catch (err) {
        next(err);
    }
};

module.exports = { sendOtp, verifyOtp };
