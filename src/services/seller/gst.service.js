const SellerModel    = require('../../models/seller');
const AppError       = require('../../utils/AppError');
const { getNextStep } = require('../../utils/onboarding');

/**
 * Mock GST verification.
 * TODO: Replace with real provider (Masters India / SignDesk / Karza).
 * Set GSTIN_VERIFY_API_KEY in .env and call their API here.
 *
 * @param {string} gstin
 * @returns {{ verified: boolean }}
 */
const mockVerifyGstin = async (gstin) => {
  // Simulate API latency
  await new Promise((r) => setTimeout(r, 300));

  // Mock rule: any structurally valid GSTIN passes.
  // In production this calls the real GST API and checks status === 'Active'.
  return { verified: true };
};

/**
 * Submit and verify GST / business details. Handles two flows:
 *
 *  hasGstin = true  → Validate & verify GSTIN, prevent duplicates
 *  hasGstin = false → Reseller / no-GSTIN flow — skip GST check
 *
 * On success, advances seller to ADDRESS_SETUP.
 */
const submitGst = async (sellerId, data) => {
  const seller = await SellerModel.findById(sellerId);
  if (!seller) throw new AppError('Seller not found.', 404, 'SELLER_NOT_FOUND');

  if (!seller.mobileVerified) {
    throw new AppError('Mobile must be verified before GST submission.', 403, 'MOBILE_NOT_VERIFIED');
  }

  let gstVerified = false;

  if (data.hasGstin) {
    // Duplicate GSTIN check
    const existing = await SellerModel.findBusinessByGstin(data.gstin);
    if (existing && existing.sellerId !== sellerId) {
      throw new AppError(
        'This GSTIN is already registered with another account.',
        409,
        'DUPLICATE_GSTIN'
      );
    }

    const result = await mockVerifyGstin(data.gstin);
    if (!result.verified) {
      throw new AppError(
        'GST verification failed. Please check your GSTIN and try again.',
        422,
        'GST_VERIFICATION_FAILED'
      );
    }

    gstVerified = true;
  }

  const businessData = {
    gstin:        data.hasGstin ? data.gstin : null,
    hasGstin:     data.hasGstin,
    businessName: data.businessName,
    panNumber:    data.panNumber,
    businessType: data.businessType,
    gstVerified,
  };

  const businessDetails = await SellerModel.upsertBusiness(sellerId, businessData);

  // Advance onboarding — resellers pass without GST
  const updatedSeller = await SellerModel.updateSeller(sellerId, {
    gstVerified:     gstVerified || !data.hasGstin,
    onboardingStatus: 'ADDRESS_SETUP',
  });

  return {
    businessDetails,
    nextStep: getNextStep(updatedSeller.onboardingStatus),
  };
};

module.exports = { submitGst };
