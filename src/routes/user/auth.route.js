const { Router } = require('express');
const userAuthCtrl = require('../../controllers/user/auth.controller');

const router = Router();

router.post('/register',         userAuthCtrl.register);
router.post('/login',            userAuthCtrl.login);
router.post('/send-otp',         userAuthCtrl.sendOtp);
router.post('/verify-otp',       userAuthCtrl.verifyOtp);
router.post('/refresh',          userAuthCtrl.refreshToken);
router.post('/forgot-password-otp', userAuthCtrl.forgotPasswordOtp);
router.post('/verify-reset-otp',    userAuthCtrl.verifyResetOtp);
router.post('/reset-password',      userAuthCtrl.resetPassword);

module.exports = router;
