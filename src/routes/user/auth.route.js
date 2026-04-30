const { Router } = require('express');
const userAuthCtrl = require('../../controllers/user/auth.controller');

const router = Router();

router.post('/register',         userAuthCtrl.register);
router.post('/login',            userAuthCtrl.login);
router.post('/send-otp',         userAuthCtrl.sendOtp);
router.post('/verify-otp',       userAuthCtrl.verifyOtp);
router.post('/refresh',          userAuthCtrl.refreshToken);

/**
 * POST /api/user/auth/forgot-password
 * Body: { identifier } — email or mobile
 */
router.post('/forgot-password',  userAuthCtrl.forgotPassword);

/**
 * POST /api/user/auth/reset-password
 * Body: { token, newPassword }
 */
router.post('/reset-password',   userAuthCtrl.resetPassword);

module.exports = router;
