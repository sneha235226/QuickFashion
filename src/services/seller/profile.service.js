const SellerModel = require('../../models/seller');
const AppError    = require('../../utils/AppError');

/**
 * Create / update the seller's supplier profile.
 * This is the final onboarding step — marks profileCompleted = true
 * and sets onboardingStatus to COMPLETED.
 */
const createProfile = async (sellerId, data) => {
  const seller = await SellerModel.findById(sellerId);
  if (!seller) throw new AppError('Seller not found.', 404, 'SELLER_NOT_FOUND');

  if (!seller.bankVerified) {
    throw new AppError(
      'Bank details must be verified before completing your profile.',
      403,
      'BANK_NOT_VERIFIED'
    );
  }

  // Email uniqueness check (excluding current seller's own profile)
  const existing = await SellerModel.findProfileByEmail(data.email);
  if (existing && existing.sellerId !== sellerId) {
    throw new AppError('This email is already in use by another seller.', 409, 'DUPLICATE_EMAIL');
  }

  const profileData = {
    storeName:      data.storeName,
    category:       data.category,
    businessType:   data.businessType,
    email:          data.email,
    alternatePhone: data.alternatePhone ?? null,
  };

  const profile = await SellerModel.upsertProfile(sellerId, profileData);

  // Mark onboarding complete. sellerStatus stays PENDING (default) until admin approves.
  await SellerModel.updateSeller(sellerId, {
    profileCompleted: true,
    onboardingStatus: 'COMPLETED',
    sellerStatus:     'PENDING',
  });

  return {
    profile,
    nextStep: null,
    approvalStatus: 'PENDING',
    message: 'Onboarding complete! Your account is now under admin review. We will notify you once approved.',
  };
};

/**
 * Fetch the full onboarding status snapshot for a seller.
 */
const getOnboardingStatus = async (sellerId) => {
  const data = await SellerModel.getOnboardingSnapshot(sellerId);
  if (!data) throw new AppError('Seller not found.', 404, 'SELLER_NOT_FOUND');
  return data;
};

/**
 * Returns the seller's current approval status.
 * Used by the frontend to poll after onboarding is complete.
 */
const getApprovalStatus = async (sellerId) => {
  const seller = await SellerModel.findByIdSelect(sellerId, {
    id:               true,
    onboardingStatus: true,
    sellerStatus:     true,
    rejectionReason:  true,
  });

  if (!seller) throw new AppError('Seller not found.', 404, 'SELLER_NOT_FOUND');

  const messages = {
    PENDING:   'Your account is under review. We typically respond within 24–48 hours.',
    APPROVED:  'Congratulations! Your account is approved. Welcome to QuickFashion.',
    REJECTED:  `Your account was not approved. Reason: ${seller.rejectionReason ?? 'Not specified'}. Please contact support.`,
    SUSPENDED: 'Your account has been suspended. Please contact support.',
  };

  return {
    onboardingStatus: seller.onboardingStatus,
    sellerStatus:     seller.sellerStatus,
    message:          messages[seller.sellerStatus],
    ...(seller.rejectionReason && { rejectionReason: seller.rejectionReason }),
  };
};

module.exports = { createProfile, getOnboardingStatus, getApprovalStatus };
