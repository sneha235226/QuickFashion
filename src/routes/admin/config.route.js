const { Router } = require('express');
const { adminProtect } = require('../../middleware/auth');
const configCtrl = require('../../controllers/admin/config.controller');

const router = Router();

/**
 * GET /api/admin/config/commission
 * Get platform commission rate.
 */
router.get('/commission', adminProtect, configCtrl.getCommissionRate);

/**
 * POST /api/admin/config/commission
 * Set the platform commission rate for the first time. Body: { rate: 5 }
 */
router.post('/commission', adminProtect, configCtrl.updateCommissionRate);

/**
 * PUT /api/admin/config/commission
 * Update the platform commission rate. Body: { rate: 5 }
 */
router.put('/commission', adminProtect, configCtrl.updateCommissionRate);

module.exports = router;
