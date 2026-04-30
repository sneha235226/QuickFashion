const authService = require('../../services/auth.service');
const UserModel = require('../../models/user');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { registerSchema, sendOtpSchema, verifyOtpSchema, loginSchema } = require('../../validators/user/auth.validator');
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
 * POST /api/user/auth/login
 * Unified login (Email or Phone with Password)
 */
const login = async (req, res, next) => {
    try {
        const { error, value } = loginSchema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400, 'VALIDATION_ERROR'));

        const { identifier, email, mobile, password } = value;
        const loginId = identifier || email || mobile;

        // Find user by email or phone
        const user = await UserModel.findByIdentifier(loginId);

        if (!user || !user.password) {
            return next(new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS'));
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return next(new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS'));
        }

        // Generate tokens
        const jwt = require('../../utils/jwt');
        const tokens = jwt.generateUserTokens({ userId: user.id, mobile: user.mobileNumber });
        await UserModel.updateRefreshToken(user.id, tokens.refreshToken);

        return response.success(res, 'Login successful.', {
            tokens,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                mobile: user.mobileNumber
            }
        });
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

/**
 * POST /api/user/auth/forgot-password
 * Generates a secure reset token and (in production) sends it via email/SMS.
 * Body: { identifier } — accepts email or mobile number
 */
const forgotPassword = async (req, res, next) => {
    try {
        const { identifier } = req.body;
        if (!identifier) {
            return next(new AppError('Email or mobile number is required.', 400, 'VALIDATION_ERROR'));
        }

        const user = await UserModel.findByIdentifier(identifier);

        // Always return success to avoid user enumeration
        if (!user) {
            return response.success(res, 'If an account with that identifier exists, a reset link has been sent.');
        }

        // Generate a secure random token (hex, 32 bytes = 64 chars)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await UserModel.updatePasswordReset(user.id, {
            passwordResetToken:  resetToken,
            passwordResetExpiry: resetExpiry,
        });

        // TODO: In production, send resetToken via email/SMS instead of returning it
        // e.g. await emailService.sendResetLink(user.email, resetToken);

        return response.success(res, 'Password reset token generated.', {
            resetToken, // Remove this in production — send via email/SMS instead
            expiresAt: resetExpiry,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/user/auth/reset-password
 * Verifies the reset token and sets the new password.
 * Body: { token, newPassword }
 */
const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return next(new AppError('Token and new password are required.', 400, 'VALIDATION_ERROR'));
        }
        if (newPassword.length < 6) {
            return next(new AppError('Password must be at least 6 characters.', 400, 'VALIDATION_ERROR'));
        }

        const user = await UserModel.findByResetToken(token);

        if (!user) {
            return next(new AppError('Invalid or expired reset token.', 400, 'INVALID_TOKEN'));
        }

        // Check token expiry
        if (!user.passwordResetExpiry || new Date() > new Date(user.passwordResetExpiry)) {
            return next(new AppError('Reset token has expired. Please request a new one.', 400, 'TOKEN_EXPIRED'));
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear the reset token
        await UserModel.updatePasswordReset(user.id, {
            password:            hashedPassword,
            passwordResetToken:  null,
            passwordResetExpiry: null,
            refreshToken:        null, // Invalidate all active sessions
        });

        return response.success(res, 'Password reset successfully. Please login with your new password.');
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/user/auth/forgot-password-otp
 * Triggers an OTP for password reset.
 */
const forgotPasswordOtp = async (req, res, next) => {
    try {
        const { mobile } = req.body;
        if (!mobile) return next(new AppError('Mobile number is required.', 400, 'VALIDATION_ERROR'));

        const user = await UserModel.findByMobile(mobile);
        if (!user) {
            return next(new AppError('No account found with this mobile number.', 404, 'NOT_FOUND'));
        }

        const { requestId } = await authService.sendOtp(mobile, 'USER');
        return response.success(res, `OTP sent to ${mobile}.`, { requestId });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/user/auth/verify-reset-otp
 * Step 2 of 3: Verifies OTP and returns a temporary reset token.
 */
const verifyResetOtp = async (req, res, next) => {
    try {
        const { mobile, otp, requestId } = req.body;
        if (!mobile || !otp) {
            return next(new AppError('Mobile and OTP are required.', 400, 'VALIDATION_ERROR'));
        }

        // 1. Verify OTP
        await authService.verifyOtpForPasswordReset(mobile, otp, 'USER', requestId);

        // 2. Find user
        const user = await UserModel.findByMobile(mobile);
        if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

        // 3. Generate a temporary reset token (valid for 10 mins)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 10 * 60 * 1000);

        await UserModel.updatePasswordReset(user.id, {
            passwordResetToken:  resetToken,
            passwordResetExpiry: resetExpiry,
        });

        return response.success(res, 'OTP verified successfully.', { resetToken });
    } catch (err) {
        next(err);
    }
};

module.exports = { 
    register, 
    login, 
    sendOtp, 
    verifyOtp, 
    refreshToken, 
    forgotPassword, 
    resetPassword, 
    forgotPasswordOtp, 
    verifyResetOtp 
};
