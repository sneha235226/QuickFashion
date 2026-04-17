const SellerModel = require('../../models/seller');
const { generateSellerTokens, verifyRefreshToken } = require('../../utils/jwt');
const AppError = require('../../utils/AppError');
const { getNextStep } = require('../../utils/onboarding');

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Issue access + refresh tokens for a verified seller.
 * Stores the refresh token in DB for rotation validation.
 */
const issueTokens = async (seller) => {
  const { accessToken, refreshToken } = generateSellerTokens({
    sellerId: seller.id,
    mobile: seller.mobile,
  });

  await SellerModel.updateSeller(seller.id, { refreshToken });

  return {
    accessToken,
    refreshToken,
    nextStep: getNextStep(seller.onboardingStatus),
  };
};

/**
 * Rotate tokens using a valid refresh token.
 * Implements refresh token rotation — old token is invalidated on use.
 * If a reused token is detected, all sessions are killed immediately.
 */
const refreshTokens = async (token) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401, 'REFRESH_TOKEN_INVALID');
  }

  const seller = await SellerModel.findById(decoded.sellerId);

  if (!seller || seller.refreshToken !== token) {
    // Token reuse detected — wipe all sessions for safety
    if (seller) {
      await SellerModel.updateSeller(seller.id, { refreshToken: null });
    }
    throw new AppError('Refresh token reuse detected. Please login again.', 401, 'TOKEN_REUSE');
  }

  return issueTokens(seller);
};

/**
 * Logout — invalidate the stored refresh token.
 */
const logout = async (sellerId) => {
  await SellerModel.updateSeller(sellerId, { refreshToken: null });
};

module.exports = { issueTokens, refreshTokens, logout };
