const { Router } = require('express');
const { protect, requireApproved } = require('../../middleware/auth');
const inventoryCtrl = require('../../controllers/seller/inventory.controller');

const router = Router();

router.use(protect, requireApproved);

router.get('/', inventoryCtrl.getInventory);
router.patch('/:productId', inventoryCtrl.updateStock);

module.exports = router;
