const { Router } = require('express');
const sellerRoutes = require('./seller/seller.route');
const adminRoutes = require('./admin/admin.route');
const authRoutes = require('./auth.route');
const userAuthRoutes = require('./user/auth.route');
const userProdRoutes = require('./user/product.route');
const cartRoutes = require('./user/cart.route');
const wishlistRoutes = require('./user/wishlist.route');

const router = Router();

router.use('/auth', authRoutes); // old auth routes
router.use('/user/auth', userAuthRoutes);
router.use('/user/cart', cartRoutes);
router.use('/user/wishlist', wishlistRoutes);
router.use('/seller', sellerRoutes);
router.use('/admin', adminRoutes);
router.use('/products', userProdRoutes);

// Health-check
router.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
