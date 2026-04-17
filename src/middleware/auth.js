const { verifyAccessToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const SellerModel = require('../models/seller');
const AdminModel = require('../models/admin');

// ─── Seller guards ────────────────────────────────────────────────────────────

/**
 * protect — verifies JWT, attaches req.seller to every protected seller route.
 *
 * req.seller = { sellerId, mobile, role, onboardingStatus, sellerStatus }
 */
const protect = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication token is missing.', 401, 'TOKEN_MISSING'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (decoded.role !== 'seller') {
      return next(new AppError('Invalid token role.', 403, 'FORBIDDEN'));
    }

    const seller = await SellerModel.findByIdSelect(decoded.sellerId, {
      id: true,
      mobile: true,
      sellerStatus: true,
    });


    if (!seller) {
      return next(new AppError('Seller account no longer exists.', 401, 'SELLER_NOT_FOUND'));
    }

    req.seller = {
      id: seller.id,        // used by catalog & product controllers
      sellerId: seller.id,        // kept for onboarding controllers (otp, profile, bank, gst, address)
      mobile: seller.mobile,
      role: decoded.role,
      sellerStatus: seller.sellerStatus,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Access token has expired. Please refresh.', 401, 'TOKEN_EXPIRED'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid access token.', 401, 'TOKEN_INVALID'));
    }
    next(err);
  }
};

// ─── Onboarding guard ─────────────────────────────────────────────────────────

const onboardingProtect = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication token missing.', 401, 'TOKEN_MISSING'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (decoded.role !== 'seller_onboarding') {
      return next(new AppError('Invalid token role.', 403, 'FORBIDDEN'));
    }

    req.onboarding = { phone: decoded.phone };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expired. Please login again.', 401, 'TOKEN_EXPIRED'));
    }
    next(new AppError('Invalid token.', 401, 'TOKEN_INVALID'));
  }
};

/**
 * requireMobileVerified — blocks onboarding routes until mobile is confirmed.
 */
const requireMobileVerified = (req, _res, next) => {
  if (!req.seller) {
    return next(new AppError('Unauthenticated.', 401, 'UNAUTHENTICATED'));
  }
  // All full sellers are implicitly mobile verified as they passed onboarding
  next();
};

/**
 * requireApproved — blocks home/dashboard routes until admin has approved the seller.
 *
 * Must be placed AFTER protect in the middleware chain.
 *
 * States:
 *  PENDING   → "Under review" (onboarding may not even be complete yet)
 *  REJECTED  → "Rejected — reason shown to seller"
 *  SUSPENDED → "Suspended"
 *  APPROVED  → passes through
 */
const requireApproved = (req, _res, next) => {
  if (!req.seller) {
    return next(new AppError('Unauthenticated.', 401, 'UNAUTHENTICATED'));
  }

  const { sellerStatus } = req.seller;

  if (sellerStatus === 'PENDING') {
    return next(new AppError(
      'Your account is under review. We will notify you once approved.',
      403,
      'APPROVAL_PENDING'
    ));
  }

  if (sellerStatus === 'REJECTED') {
    return next(new AppError(
      'Your seller account was not approved. Please contact support.',
      403,
      'ACCOUNT_REJECTED'
    ));
  }

  if (sellerStatus === 'SUSPENDED') {
    return next(new AppError(
      'Your seller account has been suspended. Please contact support.',
      403,
      'ACCOUNT_SUSPENDED'
    ));
  }

  // sellerStatus === 'APPROVED' — allow through
  next();
};

// ─── Admin guard ──────────────────────────────────────────────────────────────

/**
 * adminProtect — verifies JWT for admin routes.
 * Attaches req.admin = { adminId, email, role }
 */
const adminProtect = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication token is missing.', 401, 'TOKEN_MISSING'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (decoded.role !== 'admin') {
      return next(new AppError('Access denied. Admin token required.', 403, 'FORBIDDEN'));
    }

    const admin = await AdminModel.findById(decoded.adminId);
    if (!admin) {
      return next(new AppError('Admin account no longer exists.', 401, 'ADMIN_NOT_FOUND'));
    }

    req.admin = {
      adminId: admin.id,
      email: admin.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Access token has expired. Please refresh.', 401, 'TOKEN_EXPIRED'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid access token.', 401, 'TOKEN_INVALID'));
    }
    next(err);
  }
};

const UserModel = require('../models/user');

// ─── User guards ──────────────────────────────────────────────────────────────

/**
 * userProtect — verifies JWT, attaches req.user to every protected user route.
 *
 * req.user = { userId, mobile, role }
 */
const userProtect = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication token is missing.', 401, 'TOKEN_MISSING'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (decoded.role !== 'user') {
      return next(new AppError('Invalid token role. User token required.', 403, 'FORBIDDEN'));
    }

    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return next(new AppError('User account no longer exists.', 401, 'USER_NOT_FOUND'));
    }

    req.user = {
      id: user.id,
      userId: user.id,
      mobile: user.mobileNumber,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Access token has expired. Please refresh.', 401, 'TOKEN_EXPIRED'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid access token.', 401, 'TOKEN_INVALID'));
    }
    next(err);
  }
};

module.exports = { protect, onboardingProtect, requireMobileVerified, requireApproved, adminProtect, userProtect };
