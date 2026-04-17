const { Router } = require('express');
const authController = require('../controllers/auth.controller');

const router = Router();

/**
 * POST /api/auth/send-otp
 * Body: { mobileNumber, role: "USER" | "SELLER" }
 */
router.post('/send-otp', authController.sendOtp);

/**
 * POST /api/auth/verify-otp
 * Body: { mobileNumber, otp, role, requestId }
 */
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
