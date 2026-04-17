const profileService = require('../../services/seller/profile.service');
const response       = require('../../utils/response');

/**
 * POST /api/seller/onboarding/profile
 */
const createProfile = async (req, res, next) => {
  try {
    const result = await profileService.createProfile(req.seller.sellerId, req.body);
    return response.created(
      res,
      result.message,
      { profile: result.profile, approvalStatus: result.approvalStatus },
      { nextStep: result.nextStep }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/seller/onboarding/status
 */
const getOnboardingStatus = async (req, res, next) => {
  try {
    const data = await profileService.getOnboardingStatus(req.seller.sellerId);
    return response.success(res, 'Onboarding status retrieved.', data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/seller/approval-status
 * Seller polls this after onboarding to know if admin has approved them.
 */
const getApprovalStatus = async (req, res, next) => {
  try {
    const data = await profileService.getApprovalStatus(req.seller.sellerId);
    return response.success(res, data.message, data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/seller/home
 * Protected by requireApproved — only approved sellers reach here.
 */
const sellerHome = async (req, res, next) => {
  try {
    return response.success(res, 'Welcome to your seller dashboard!', {
      sellerId: req.seller.sellerId,
      mobile:   req.seller.mobile,
      status:   req.seller.sellerStatus,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createProfile, getOnboardingStatus, getApprovalStatus, sellerHome };
