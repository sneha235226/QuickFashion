const SellerModel    = require('../../models/seller');
const AppError       = require('../../utils/AppError');
const { getNextStep } = require('../../utils/onboarding');

/**
 * Add a pickup/billing address for the seller.
 *
 * - Auto-sets as default if it's the first address of its type.
 * - If isDefault requested, the swap is done inside a transaction (race-safe).
 * - Advances onboarding to BANK_SETUP on the first address ever added.
 */
const addAddress = async (sellerId, data) => {
  const seller = await SellerModel.findById(sellerId);
  if (!seller) throw new AppError('Seller not found.', 404, 'SELLER_NOT_FOUND');

  const existingCount  = await SellerModel.countAddresses(sellerId, data.type);
  const shouldBeDefault = data.isDefault || existingCount === 0;

  const address = await SellerModel.createAddressTransaction(sellerId, data, shouldBeDefault);

  let nextStep = getNextStep(seller.onboardingStatus);

  // Advance onboarding only on the very first address
  if (!seller.addressAdded) {
    const updated = await SellerModel.updateSeller(sellerId, {
      addressAdded:    true,
      onboardingStatus: 'BANK_SETUP',
    });
    nextStep = getNextStep(updated.onboardingStatus);
  }

  return { address, nextStep };
};

/**
 * Set a specific address as the default for its type.
 * The swap is done atomically — no race condition possible.
 */
const setDefaultAddress = async (sellerId, addressId) => {
  const address = await SellerModel.findAddressById(addressId, sellerId);
  if (!address) {
    throw new AppError(
      'Address not found or does not belong to this seller.',
      404,
      'ADDRESS_NOT_FOUND'
    );
  }

  await SellerModel.setDefaultAddressTransaction(sellerId, addressId, address.type);
  return { message: 'Default address updated.' };
};

/**
 * List all addresses for a seller (default first).
 */
const listAddresses = async (sellerId) => {
  return SellerModel.findAllAddresses(sellerId);
};

/**
 * Delete an address. Blocks deletion of the sole default address.
 */
const deleteAddress = async (sellerId, addressId) => {
  const address = await SellerModel.findAddressById(addressId, sellerId);
  if (!address) throw new AppError('Address not found.', 404, 'ADDRESS_NOT_FOUND');

  if (address.isDefault) {
    const total = await SellerModel.countAddresses(sellerId, address.type);
    if (total <= 1) {
      throw new AppError(
        'Cannot delete the only default address. Add another address first.',
        400,
        'CANNOT_DELETE_DEFAULT'
      );
    }
  }

  await SellerModel.deleteAddressById(addressId);
  return { message: 'Address deleted.' };
};

module.exports = { addAddress, setDefaultAddress, listAddresses, deleteAddress };
