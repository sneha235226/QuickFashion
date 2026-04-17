const SellerModel    = require('../../models/seller');
const AppError       = require('../../utils/AppError');
const encryption     = require('../../utils/encryption');
const ifscUtil       = require('../../utils/ifsc');
const { getNextStep } = require('../../utils/onboarding');

/**
 * Mock penny-drop verification.
 * TODO: Replace with real provider (Razorpay / Cashfree / Digio).
 * Set PENNY_DROP_API_KEY in .env and call their API here.
 *
 * Mock rule: accounts ending in '0000' fail — useful for testing error path.
 */
const mockPennyDrop = async (details) => {
  await new Promise((r) => setTimeout(r, 400)); // simulate latency

  if (details.accountNumber.endsWith('0000')) {
    return { verified: false, ref: null };
  }
  return { verified: true, ref: `PD_${Date.now()}` };
};

/**
 * Add bank details for a seller.
 *
 * Flow:
 *  1. Validate IFSC format + auto-fill bank name & branch.
 *  2. Duplicate account check via HMAC (no plaintext stored).
 *  3. Mock penny-drop verification (plug real API via .env).
 *  4. Encrypt account number with AES-256-GCM before storing.
 *  5. Advance onboarding to PROFILE_SETUP.
 */
const addBankDetails = async (sellerId, data) => {
  const seller = await SellerModel.findById(sellerId);
  if (!seller) throw new AppError('Seller not found.', 404, 'SELLER_NOT_FOUND');

  // 1. IFSC validation + bank name auto-fill
  const ifscResult = ifscUtil.validateAndLookup(data.ifsc);
  if (!ifscResult.valid) {
    throw new AppError(ifscResult.error, 422, 'INVALID_IFSC');
  }

  // 2. Duplicate account detection via HMAC
  const accountNumberHmac = encryption.hmac(data.accountNumber);
  const duplicate = await SellerModel.findBankByHmac(accountNumberHmac);
  if (duplicate && duplicate.sellerId !== sellerId) {
    throw new AppError(
      'This bank account is already registered with another seller.',
      409,
      'DUPLICATE_BANK_ACCOUNT'
    );
  }

  // 3. Penny-drop verification (mock — swap for real API)
  const pennyResult = await mockPennyDrop({
    accountNumber:     data.accountNumber,
    ifsc:              data.ifsc,
    accountHolderName: data.accountHolderName,
  });

  if (!pennyResult.verified) {
    throw new AppError(
      'Bank account verification failed. Please check your account number and IFSC.',
      422,
      'PENNY_DROP_FAILED'
    );
  }

  // 4. Encrypt account number
  const accountNumberEncrypted = encryption.encrypt(data.accountNumber);

  // 5. Upsert bank details
  const bankData = {
    accountHolderName:     data.accountHolderName,
    accountNumberEncrypted,
    accountNumberHmac,
    ifsc:                  data.ifsc.toUpperCase(),
    bankName:              ifscResult.bankName,
    branch:                ifscResult.branch,
    verified:              true,
    verificationRef:       pennyResult.ref,
  };

  const bankDetails = await SellerModel.upsertBank(sellerId, bankData);

  // Advance onboarding
  const updatedSeller = await SellerModel.updateSeller(sellerId, {
    bankVerified:    true,
    onboardingStatus: 'PROFILE_SETUP',
  });

  // Never expose encrypted fields in response
  const { accountNumberEncrypted: _enc, accountNumberHmac: _hmac, ...safeBankDetails } = bankDetails;

  return {
    bankDetails: {
      ...safeBankDetails,
      accountNumberMasked: `${'*'.repeat(Math.max(0, data.accountNumber.length - 4))}${data.accountNumber.slice(-4)}`,
    },
    nextStep: getNextStep(updatedSeller.onboardingStatus),
  };
};

module.exports = { addBankDetails };
