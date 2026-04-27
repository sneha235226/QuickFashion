const { Router } = require('express');
const { userProtect } = require('../../middleware/auth');
const orderCtrl = require('../../controllers/user/order.controller');

const router = Router();

router.use(userProtect);

router.post('/', orderCtrl.placeOrder);
router.get('/', orderCtrl.getOrders);
router.get('/:id', orderCtrl.getOrderDetail);

module.exports = router;