const { Router }      = require('express');
const validate        = require('../../middleware/validate');
const { adminProtect } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimiter');

const authCtrl   = require('../../controllers/admin/auth.controller');
const sellerCtrl = require('../../controllers/admin/seller.controller');

const { loginSchema, registerSchema }    = require('../../validators/admin/auth.validator');
const { rejectSchema, suspendSchema }    = require('../../validators/admin/seller.validator');

const categoryRoutes = require('./category.route');
const catalogRoutes  = require('./catalog.route');
const configRoutes   = require('./config.route');

const router = Router();

// ─── Admin Auth (public) ─────────────────────────────────────────────────────

/**
 * POST /api/admin/auth/register
 * Requires ADMIN_SECRET_KEY in body. Internal use only.
 */
router.post('/auth/register', validate(registerSchema), authCtrl.register);

/**
 * POST /api/admin/auth/login
 */
router.post('/auth/login', authLimiter, validate(loginSchema), authCtrl.login);

/**
 * POST /api/admin/auth/refresh
 */
router.post('/auth/refresh', authLimiter, authCtrl.refresh);

// ─── Admin Auth (protected) ───────────────────────────────────────────────────

/**
 * POST /api/admin/auth/logout
 */
router.post('/auth/logout', adminProtect, authCtrl.logout);

// ─── Seller Management ────────────────────────────────────────────────────────

/**
 * GET /api/admin/sellers
 * List all sellers.
 */
router.get('/sellers', adminProtect, sellerCtrl.listAll);

/**
 * GET /api/admin/sellers/pending
 * List all sellers awaiting approval.
 */
router.get('/sellers/pending', adminProtect, sellerCtrl.listPending);

/**
 * GET /api/admin/sellers/:id
 * Full seller detail for review.
 */
router.get('/sellers/:id', adminProtect, sellerCtrl.getDetail);

/**
 * POST /api/admin/sellers/:id/approve
 */
router.post('/sellers/:id/approve', adminProtect, sellerCtrl.approve);

/**
 * POST /api/admin/sellers/:id/reject
 * Body: { reason }
 */
router.post('/sellers/:id/reject', adminProtect, validate(rejectSchema), sellerCtrl.reject);

/**
 * POST /api/admin/sellers/:id/suspend
 * Body: { reason }
 */
router.post('/sellers/:id/suspend', adminProtect, validate(suspendSchema), sellerCtrl.suspend);

/**
 * POST /api/admin/sellers/:id/reapprove
 */
router.post('/sellers/:id/reapprove', adminProtect, sellerCtrl.reApprove);

// ─── Category & Catalog Management ───────────────────────────────────────────

router.use('/categories', categoryRoutes);
router.use('/catalogs',   catalogRoutes);
router.use('/config',     configRoutes);

module.exports = router;
