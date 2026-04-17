const authService = require('../../services/auth.service');
const response = require('../../utils/response');

/**
 * POST /api/seller/auth/send-otp
 */
const sendOtp = async (req, res, next) => {
  try {
    const { requestId } = await authService.sendOtp(req.body.mobile, 'SELLER');
    // Return requestId if possible, or just standard success
    return response.success(res, `OTP sent to ${req.body.mobile}.`, { requestId });
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
    const { mobile, password } = req.body;
    if (!mobile || !password) {
      const AppError = require('../../utils/AppError');
      return next(new AppError('Mobile and password are required', 400, 'BAD_REQUEST'));
    }

    const SellerModel = require('../../models/seller');
    const seller = await SellerModel.findByMobile(mobile);

    if (!seller || seller.sellerStatus !== 'APPROVED') {
      const AppError = require('../../utils/AppError');
      return next(new AppError('Invalid credentials or seller not approved.', 401, 'UNAUTHORIZED'));
    }

    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, seller.password || '');
    if (!isMatch) {
      const AppError = require('../../utils/AppError');
      return next(new AppError('Invalid credentials.', 401, 'UNAUTHORIZED'));
    }

    const jwt = require('../../utils/jwt');
    const tokens = jwt.generateSellerTokens({ sellerId: seller.id, mobile: seller.mobile });
    await SellerModel.updateRefreshToken(seller.id, tokens.refreshToken);

    const response = require('../../utils/response');
    return response.success(res, 'Login successful.', { ...tokens }, 200);
  } catch (err) {
    next(err);
  }
};

module.exports = { sendOtp, verifyOtp, login, refreshToken, logout, getMe };
