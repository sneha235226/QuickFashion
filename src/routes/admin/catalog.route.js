const { Router }      = require('express');
const { adminProtect } = require('../../middleware/auth');
const catalogCtrl     = require('../../controllers/admin/catalog.controller');

const router = Router();

router.use(adminProtect);

/**
 * GET /api/admin/catalogs/pending
 */
router.get('/pending', catalogCtrl.listPending);

/**
 * GET /api/admin/catalogs/:id
 */
router.get('/:id', catalogCtrl.getDetail);

/**
 * POST /api/admin/catalogs/:id/approve
 */
router.post('/:id/approve', catalogCtrl.approve);

/**
 * POST /api/admin/catalogs/:id/reject
 * Body: { reason }
 */
router.post('/:id/reject', catalogCtrl.reject);

module.exports = router;
