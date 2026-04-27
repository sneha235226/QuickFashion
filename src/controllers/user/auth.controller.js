const authService = require('../../services/auth.service');
const UserModel = require('../../models/user');
const bcrypt = require('bcryptjs');
const { registerSchema, sendOtpSchema, verifyOtpSchema } = require('../../validators/user/auth.validator');
const response = require('../../utils/response');
const AppError = require('../../utils/AppError');

/**
 * POST /api/user/auth/register
 * Simple password-based registration
 */
const register = async (req, res, next) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400, 'VALIDATION_ERROR'));

        const existingUser = await UserModel.findByMobile(value.mobile);
        if (existingUser) {
            return next(new AppError('User with this mobile number already exists.', 409, 'USER_EXISTS'));
        }

        const hashedPassword = await bcrypt.hash(value.password, 10);
        const newUser = await UserModel.create({
            mobileNumber: value.mobile,
            name: value.name,
            email: value.email,
            password: hashedPassword
        });

        const jwt = require('../../utils/jwt');
        const tokens = jwt.generateUserTokens({ userId: newUser.id, mobile: newUser.mobileNumber });
        await UserModel.updateRefreshToken(newUser.id, tokens.refreshToken);

        return response.success(res, 'User registered successfully.', { tokens, user: { id: newUser.id, name: newUser.name } });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/user/auth/send-otp
 * Login OTP trigger
 */
const sendOtp = async (req, res, next) => {
    try {
        const { error, value } = sendOtpSchema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400, 'VALIDATION_ERROR'));

        // Send OTP regardless of user existence to support both Login and Registration
        const { requestId } = await authService.sendOtp(value.mobile, 'USER');
        return response.success(res, `OTP sent to ${value.mobile}.`, { requestId });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/user/auth/verify-otp
 * Login OTP verification
 */
const verifyOtp = async (req, res, next) => {
    try {
        const { error, value } = verifyOtpSchema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400, 'VALIDATION_ERROR'));
        const { mobile, otp, requestId } = value;
        const tokens = await authService.verifyOtp(
            mobile,
            otp,
            'USER',
            requestId
        );
        return response.success(res, 'Login successful.', { ...tokens });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/user/auth/refresh
 */
const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken: token } = req.body;
        if (!token) return next(new AppError('Refresh token is required.', 400, 'REFRESH_TOKEN_REQUIRED'));

        const tokens = await authService.refreshTokens(token);
        return response.success(res, 'Tokens refreshed successfully.', { ...tokens });
    } catch (err) {
        next(err);
    }
};

module.exports = { register, sendOtp, verifyOtp, refreshToken };
