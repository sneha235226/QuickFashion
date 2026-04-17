const bcrypt                               = require('bcryptjs');
const AdminModel                           = require('../../models/admin');
const { generateAdminTokens, verifyRefreshToken } = require('../../utils/jwt');
const AppError                             = require('../../utils/AppError');

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'quickfashion_admin_2024';

/**
 * Register a new admin.
 * Protected by a secret key set in .env — only internal use.
 */
const registerAdmin = async (data) => {
  if (data.secretKey !== ADMIN_SECRET_KEY) {
    throw new AppError('Invalid admin secret key.', 403, 'INVALID_SECRET');
  }

  const existing = await AdminModel.findByEmail(data.email);
  if (existing) {
    throw new AppError('An admin with this email already exists.', 409, 'DUPLICATE_EMAIL');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const admin = await AdminModel.createAdmin({
    username:     data.username,
    email:        data.email,
    passwordHash,
  });

  const { passwordHash: _, ...safeAdmin } = admin;
  return safeAdmin;
};

/**
 * Login with email + password.
 * Returns access + refresh tokens.
 */
const loginAdmin = async (email, password) => {
  const admin = await AdminModel.findByEmail(email);
  if (!admin) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  return issueAdminTokens(admin);
};

/**
 * Issue + store new access/refresh token pair.
 */
const issueAdminTokens = async (admin) => {
  const { accessToken, refreshToken } = generateAdminTokens({
    adminId: admin.id,
    email:   admin.email,
  });

  await AdminModel.updateAdmin(admin.id, { refreshToken });

  return { accessToken, refreshToken };
};

/**
 * Rotate admin refresh token.
 */
const refreshAdminTokens = async (token) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401, 'REFRESH_TOKEN_INVALID');
  }

  if (!decoded.adminId) {
    throw new AppError('Invalid refresh token type.', 401, 'TOKEN_INVALID');
  }

  const admin = await AdminModel.findById(decoded.adminId);
  if (!admin || admin.refreshToken !== token) {
    if (admin) await AdminModel.updateAdmin(admin.id, { refreshToken: null });
    throw new AppError('Token reuse detected. Please login again.', 401, 'TOKEN_REUSE');
  }

  return issueAdminTokens(admin);
};

const logoutAdmin = async (adminId) => {
  await AdminModel.updateAdmin(adminId, { refreshToken: null });
};

module.exports = { registerAdmin, loginAdmin, refreshAdminTokens, logoutAdmin };
