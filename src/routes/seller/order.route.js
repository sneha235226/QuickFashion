const { Router } = require('express');
const { protect, requireApproved } = require('../../middleware/auth');
const orderCtrl = require('../../controllers/seller/order.controller');

const router = Router();

router.use(protect, requireApproved);

/**
 * GET /api/seller/orders
 * List this seller's order items with filters.
 */
router.get('/', orderCtrl.getOrders);

module.exports = router;
