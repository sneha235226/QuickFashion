const jwt = require('jsonwebtoken');
const env = require('../config/env');

// ─── User tokens ──────────────────────────────────────────────────────────────

const generateUserTokens = (payload) => {
  const accessToken = jwt.sign(
    { userId: payload.userId, mobile: payload.mobile, role: 'user' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY }
  );
  const refreshToken = jwt.sign(
    { userId: payload.userId },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY }
  );
  return { accessToken, refreshToken };
};

// ─── Onboarding tokens ────────────────────────────────────────────────────────
const generateOnboardingToken = (payload) => {
  return jwt.sign(
    { phone: payload.phone, role: 'seller_onboarding' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '24h' }
  );
};

// ─── Seller tokens ────────────────────────────────────────────────────────────

const generateSellerTokens = (payload) => {
  const accessToken = jwt.sign(
    { sellerId: payload.sellerId, mobile: payload.mobile, role: 'seller' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY }
  );
  const refreshToken = jwt.sign(
    { sellerId: payload.sellerId },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY }
  );
  return { accessToken, refreshToken };
};

// ─── Admin tokens ─────────────────────────────────────────────────────────────

const generateAdminTokens = (payload) => {
  const accessToken = jwt.sign(
    { adminId: payload.adminId, email: payload.email, role: 'admin' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY }
  );
  const refreshToken = jwt.sign(
    { adminId: payload.adminId },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY }
  );
  return { accessToken, refreshToken };
};

// ─── Verify ───────────────────────────────────────────────────────────────────

const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

module.exports = {
  generateUserTokens,
  generateSellerTokens,
  generateAdminTokens,
  generateOnboardingToken,
  verifyAccessToken,
  verifyRefreshToken,
};
