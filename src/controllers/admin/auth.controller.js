const adminAuthService = require('../../services/admin/auth.service');
const response         = require('../../utils/response');

/**
 * POST /api/admin/auth/register
 * Only works with correct ADMIN_SECRET_KEY in .env — not a public endpoint.
 */
const register = async (req, res, next) => {
  try {
    const admin = await adminAuthService.registerAdmin(req.body);
    return response.created(res, 'Admin account created.', { admin });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/auth/login
 * Body: { email, password }
 */
const login = async (req, res, next) => {
  try {
    const tokens = await adminAuthService.loginAdmin(req.body.email, req.body.password);
    return response.success(res, 'Admin login successful.', tokens);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/auth/refresh
 * Body: { refreshToken }
 */
const refresh = async (req, res, next) => {
  try {
    const tokens = await adminAuthService.refreshAdminTokens(req.body.refreshToken);
    return response.success(res, 'Tokens refreshed.', tokens);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    await adminAuthService.logoutAdmin(req.admin.adminId);
    return response.success(res, 'Admin logged out.');
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout };
