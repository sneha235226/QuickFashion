const { Router } = require('express');
const { userProtect } = require('../../middleware/auth');
const wishlistCtrl = require('../../controllers/user/wishlist.controller');

const router = Router();

router.use(userProtect);

router.get('/', wishlistCtrl.getWishlist);
router.post('/', wishlistCtrl.addToWishlist);
router.delete('/:productId', wishlistCtrl.removeFromWishlist);

module.exports = router;
