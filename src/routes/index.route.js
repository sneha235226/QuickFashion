const { Router } = require('express');
const sellerRoutes = require('./seller/seller.route');
const adminRoutes = require('./admin/admin.route');
const userRoutes = require('./user/user.route');

const router = Router();

router.use('/user', userRoutes);
router.use('/seller', sellerRoutes);
router.use('/admin', adminRoutes);

// Health-check
router.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
