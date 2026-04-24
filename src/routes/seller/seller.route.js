const { Router } = require('express');
const validate = require('../../middleware/validate');
const { protect, requireMobileVerified, requireApproved, onboardingProtect } = require('../../middleware/auth');
const { otpSendLimiter, authLimiter } = require('../../middleware/rateLimiter');
const { uploadGst, uploadDocument } = require('../../middleware/upload');


// Controllers
const otpCtrl = require('../../controllers/seller/otp.controller');
const onboardingCtrl = require('../../controllers/seller/onboarding.controller');
const profileCtrl = require('../../controllers/seller/profile.controller');
const catalogCtrl = require('../../controllers/seller/catalog.controller');

// Validators
const { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } = require('../../validators/seller/otp.validator');
const { addBankSchema } = require('../../validators/seller/bank.validator');
const { createProfileSchema } = require('../../validators/seller/profile.validator');

// Validation wrapper
const Joi = require('joi');
const loginSchema = Joi.object({
  mobile: Joi.string().required(),
  password: Joi.string().required()
});

// Marketplace routes
const categoryRoutes = require('./category.route');
const catalogRoutes = require('./catalog.route');

const router = Router();

/**
 * POST /api/seller/auth/send-otp
 * Rate limited: max 3 OTP requests per mobile per hour
 */
router.post(
  '/auth/send-otp',
  otpSendLimiter,
  validate(sendOtpSchema),
  otpCtrl.sendOtp
);

/**
 * POST /api/seller/auth/verify-otp
 * Rate limited: 10 attempts per IP per 15 min
 */
router.post(
  '/auth/verify-otp',
  authLimiter,
  validate(verifyOtpSchema),
  otpCtrl.verifyOtp
);

/**
 * POST /api/seller/auth/login
 */
router.post(
  '/auth/login',
  authLimiter,
  validate(loginSchema),
  otpCtrl.login
);

/**
 * POST /api/seller/auth/refresh
 */
router.post(
  '/auth/refresh',
  authLimiter,
  validate(refreshTokenSchema),
  otpCtrl.refreshToken
);

// ─── Protected auth routes ───────────────────────────────────────────────────

/**
 * POST /api/seller/auth/logout
 */
router.post('/auth/logout', protect, otpCtrl.logout);

/**
 * GET /api/seller/auth/me
 */
router.get('/auth/me', protect, otpCtrl.getMe);

// ─── Post-OTP Onboarding routes (guarded by onboardingProtect) ─────────────────────

/**
 * GET /api/seller/onboarding/status
 */
router.get(
  '/onboarding/status',
  onboardingProtect,
  onboardingCtrl.getStatus
);

/**
 * POST /api/seller/onboarding/upload-gst
 */
router.post(
  '/onboarding/upload-gst',
  onboardingProtect,
  uploadGst,
  onboardingCtrl.uploadGst
);


/**
 * POST /api/seller/onboarding/step1
 */
router.post(
  '/onboarding/step1',
  onboardingProtect,
  onboardingCtrl.step1
);

/**
 * POST /api/seller/onboarding/step2
 */
router.post(
  '/onboarding/step2',
  onboardingProtect,
  uploadGst,
  onboardingCtrl.step2
);

/**
 * POST /api/seller/onboarding/step3
 */
router.post(
  '/onboarding/step3',
  onboardingProtect,
  require('multer')().none(),
  onboardingCtrl.step3
);

// ─── Home / Dashboard (only APPROVED sellers) ────────────────────────────────

/**
 * GET /api/seller/home
 * requireApproved blocks PENDING, REJECTED, SUSPENDED sellers.
 */
router.get('/home', protect, requireApproved, profileCtrl.sellerHome);

router.use('/categories', categoryRoutes);
router.use('/catalog', catalogRoutes);

module.exports = router;
