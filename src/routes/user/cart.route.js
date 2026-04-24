const { Router } = require('express');
const { userProtect } = require('../../middleware/auth');
const cartCtrl = require('../../controllers/user/cart.controller');

const router = Router();

router.use(userProtect);

router.get('/', cartCtrl.getCart);
router.post('/items', cartCtrl.addItem);
router.patch('/items/:itemId', cartCtrl.updateItem);
router.delete('/items/:itemId', cartCtrl.removeItem);

module.exports = router;
