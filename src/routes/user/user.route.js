const { Router } = require('express');
const cartRoutes = require('./cart.route');
const wishlistRoutes = require('./wishlist.route');
const userAuthRoutes = require('./auth.route');
const userProdRoutes = require('./product.route');
const orderRoutes = require('./order.route');
const router = Router();

router.use('/auth', userAuthRoutes);
router.use('/cart', cartRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/products', userProdRoutes);
router.use('/orders', orderRoutes);

module.exports = router;
