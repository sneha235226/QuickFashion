const { Router } = require('express');
const userAuthCtrl = require('../../controllers/user/auth.controller');

const router = Router();

router.post('/register', userAuthCtrl.register);
router.post('/send-otp', userAuthCtrl.sendOtp);
router.post('/verify-otp', userAuthCtrl.verifyOtp);
router.post('/refresh', userAuthCtrl.refreshToken);


module.exports = router;
