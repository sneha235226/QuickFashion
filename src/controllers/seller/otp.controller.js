const authService = require('../../services/auth.service');
const response = require('../../utils/response');

/**
 * POST /api/seller/auth/send-otp
 */
const sendOtp = async (req, res, next) => {
  try {
    const mobile = req.body.mobile;
    const SellerModel = require('../../models/seller');
    const SellerOnboardingModel = require('../../models/seller_onboarding');
    const AppError = require('../../utils/AppError');

    const existingSeller = await SellerModel.findByMobile(mobile);
    if (existingSeller) {
      return next(new AppError('Account already exists. Please login.', 400, 'ALREADY_EXISTS'));
    }

    const existingOnboarding = await SellerOnboardingModel.findByPhone(mobile);
    if (existingOnboarding && existingOnboarding.stepCompleted >= 1) {
      return next(new AppError('Registration already in progress. Please login with your password to continue.', 400, 'ALREADY_EXISTS'));
    }

    const { requestId } = await authService.sendOtp(mobile, 'SELLER');
    // Return requestId if possible, or just standard success
    return response.success(res, `OTP sent to ${mobile}.`, { requestId });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/auth/verify-otp
 */
const verifyOtp = async (req, res, next) => {
  try {
    const tokens = await authService.verifyOtp(
      req.body.mobile,
      req.body.otp,
      'SELLER',
      req.body.requestId
    );

    return response.success(
      res,
      tokens.onboardingToken ? 'OTP verified. Proceed to onboarding.' : 'Login successful.',
      { ...tokens },
      200
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/auth/refresh
 * Body: { refreshToken }
 */
const refreshToken = async (req, res, next) => {
  try {
    const tokens = await authService.refreshTokens(req.body.refreshToken);
    return response.success(res, 'Tokens refreshed.', tokens, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/auth/logout
 * Requires: Bearer token
 */
const logout = async (req, res, next) => {
  try {
    await authService.logout(req.seller.sellerId);
    return response.success(res, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/seller/auth/me
 * Returns the authenticated seller's onboarding status.
 */
const getMe = async (req, res, next) => {
  try {
    return response.success(res, 'Seller info retrieved.', {
      sellerId: req.seller.sellerId,
      mobile: req.seller.mobile,
    });
  } catch (err) {
    next(err);
  }
};
/**
 * POST /api/seller/auth/login
 * Password-based login for approved sellers.
 */
const login = async (req, res, next) => {
  try {
    const { identifier, mobile, password } = req.body;
    const loginId = identifier || mobile;
    
    if (!loginId || !password) {
      const AppError = require('../../utils/AppError');
      return next(new AppError('Identifier (email/mobile) and password are required', 400, 'BAD_REQUEST'));
    }

    const SellerModel = require('../../models/seller');
    const SellerOnboardingModel = require('../../models/seller_onboarding');
    const AppError = require('../../utils/AppError');
    const bcrypt = require('bcryptjs');
    const jwt = require('../../utils/jwt');
    const response = require('../../utils/response');

    const seller = await SellerModel.findByIdentifier(loginId);

    if (seller) {
      if (seller.sellerStatus !== 'APPROVED') {
        return next(new AppError(`Account is ${seller.sellerStatus}. Please wait for admin approval or contact support.`, 403, 'UNAUTHORIZED'));
      }

      const isMatch = await bcrypt.compare(password, seller.password || '');
      if (!isMatch) {
        return next(new AppError('Invalid credentials.', 401, 'UNAUTHORIZED'));
      }

      const tokens = jwt.generateSellerTokens({ sellerId: seller.id, mobile: seller.mobile });
      await SellerModel.updateRefreshToken(seller.id, tokens.refreshToken);

      return response.success(res, 'Login successful.', { ...tokens }, 200);
    }

    // Fallback: Check onboarding table if not found in main seller table
    const onboarding = await SellerOnboardingModel.findByPhone(loginId);
    
    if (onboarding && onboarding.stepCompleted >= 1) {
      // Use the basicDetails password
      const storedPassword = onboarding.basicDetails?.password || '';
      const isMatch = await bcrypt.compare(password, storedPassword);
      
      if (!isMatch) {
        return next(new AppError('Invalid credentials.', 401, 'UNAUTHORIZED'));
      }

      // Generate an onboarding token
      const onboardingToken = jwt.generateOnboardingToken({ phone: onboarding.phone });
      
      return response.success(res, 'Resuming onboarding.', { onboardingToken, isOnboarding: true }, 200);
    }

    return next(new AppError('Invalid credentials.', 401, 'UNAUTHORIZED'));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/auth/forgot-password-otp
 */
const forgotPasswordOtp = async (req, res, next) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      const AppError = require('../../utils/AppError');
      return next(new AppError('Mobile number is required.', 400, 'VALIDATION_ERROR'));
    }

    const SellerModel = require('../../models/seller');
    const seller = await SellerModel.findByMobile(mobile);
    if (!seller) {
      const AppError = require('../../utils/AppError');
      return next(new AppError('No seller found with this mobile number.', 404, 'NOT_FOUND'));
    }

    const { requestId } = await authService.sendOtp(mobile, 'SELLER');
    return response.success(res, `OTP sent to ${mobile}.`, { requestId });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/auth/verify-reset-otp
 * Step 2 of 3: Verifies OTP and returns a temporary reset token.
 */
const verifyResetOtp = async (req, res, next) => {
  try {
    const { mobile, otp, requestId } = req.body;
    if (!mobile || !otp) {
      const AppError = require('../../utils/AppError');
      return next(new AppError('Mobile and OTP are required.', 400, 'VALIDATION_ERROR'));
    }

    // 1. Verify OTP
    await authService.verifyOtpForPasswordReset(mobile, otp, 'SELLER', requestId);

    // 2. Find seller
    const SellerModel = require('../../models/seller');
    const seller = await SellerModel.findByMobile(mobile);
    if (!seller) {
      const AppError = require('../../utils/AppError');
      throw new AppError('Seller not found.', 404, 'NOT_FOUND');
    }

    // 3. Generate a temporary reset token (valid for 10 mins)
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await SellerModel.updatePasswordReset(seller.id, {
      passwordResetToken: resetToken,
      passwordResetExpiry: resetExpiry,
    });

    return response.success(res, 'OTP verified successfully.', { resetToken });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      const AppError = require('../../utils/AppError');
      return next(new AppError('Token and new password are required.', 400, 'VALIDATION_ERROR'));
    }

    const SellerModel = require('../../models/seller');
    const seller = await SellerModel.findByResetToken(token);

    if (!seller) {
      const AppError = require('../../utils/AppError');
      return next(new AppError('Invalid or expired reset token.', 400, 'INVALID_TOKEN'));
    }

    // Check token expiry
    if (!seller.passwordResetExpiry || new Date() > new Date(seller.passwordResetExpiry)) {
      const AppError = require('../../utils/AppError');
      return next(new AppError('Reset token has expired.', 400, 'TOKEN_EXPIRED'));
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await SellerModel.updatePasswordReset(seller.id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiry: null,
      refreshToken: null,
    });

    return response.success(res, 'Password reset successfully.');
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  sendOtp, 
  verifyOtp, 
  login, 
  refreshToken, 
  logout, 
  getMe,
  forgotPasswordOtp,
  verifyResetOtp,
  resetPassword
};
