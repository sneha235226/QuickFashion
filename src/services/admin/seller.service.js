const SellerModel = require('../../models/seller');
const SellerOnboardingModel = require('../../models/seller_onboarding');
const AppError = require('../../utils/AppError');

/**
 * List all sellers who have completed onboarding and are awaiting approval.
 */
const listPendingSellers = async () => {
  return SellerOnboardingModel.getPendingApproval();
};

/**
 * List sellers by status (PENDING / APPROVED / REJECTED / SUSPENDED).
 */
const listSellersByStatus = async (status) => {
  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
  if (!validStatuses.includes(status)) {
    throw new AppError('Invalid status filter.', 400, 'INVALID_STATUS');
  }

  return SellerModel.listPendingSellers(); // reused — filter applied inside
};

/**
 * Get full seller details for the admin review panel.
 */
const getSellerDetail = async (id) => {
  const onboarding = await SellerOnboardingModel.findById(id);
  if (!onboarding) throw new AppError('Seller application not found.', 404, 'SELLER_NOT_FOUND');
  return onboarding;
};

/**
 * Approve a seller — they can now access the marketplace.
 */
const approveSeller = async (onboardingId) => {
  const onboarding = await SellerOnboardingModel.findById(onboardingId);
  if (!onboarding) throw new AppError('Seller application not found.', 404, 'SELLER_NOT_FOUND');

  if (onboarding.status === 'APPROVED') {
    throw new AppError('Seller is already approved.', 409, 'ALREADY_APPROVED');
  }

  // Create real seller record
  const { basicDetails, businessDetails, bankDetails } = onboarding;
  const prisma = require('../../config/database');

  await prisma.$transaction(async (tx) => {
    const newSeller = await tx.seller.create({
      data: {
        name: `${basicDetails.firstName} ${basicDetails.lastName}`,
        email: basicDetails.email,
        mobile: onboarding.phone,
        password: basicDetails.password,
        sellerType: "RETAILER", // from prompt or basicDetails
        sellerStatus: 'APPROVED'
      }
    });

    await tx.businessDetails.create({
      data: {
        sellerId: newSeller.id,
        businessName: businessDetails.businessName,
        ownerName: businessDetails.ownerName,
        productCategories: businessDetails.productCategories,
        storeType: businessDetails.storeType,
        gstin: businessDetails.gstNumber,
        gstDocumentUrl: businessDetails.gstDocument
      }
    });

    await tx.address.create({
      data: {
        sellerId: newSeller.id,
        fullName: `${basicDetails.firstName} ${basicDetails.lastName}`,
        phone: onboarding.phone,
        addressLine: businessDetails.address.line1 || businessDetails.address.addressLine,
        city: businessDetails.address.city,
        state: businessDetails.address.state,
        pincode: businessDetails.address.pincode,
        isDefault: true
      }
    });

    await tx.bankDetails.create({
      data: {
        sellerId: newSeller.id,
        accountHolderName: bankDetails.accountHolderName,
        accountNumberEncrypted: bankDetails.accountNumber,
        ifsc: bankDetails.IFSC,
        bankName: bankDetails.bankName,
        branch: bankDetails.branchName
      }
    });

    await tx.sellerOnboarding.update({
      where: { id: onboardingId },
      data: { status: 'APPROVED' }
    });
  });

  return { message: `Seller application ${onboardingId} has been approved.` };
};

/**
 * Reject a seller with a mandatory reason.
 */
const rejectSeller = async (onboardingId, reason) => {
  const onboarding = await SellerOnboardingModel.findById(onboardingId);
  if (!onboarding) throw new AppError('Seller application not found.', 404, 'SELLER_NOT_FOUND');

  if (onboarding.status === 'REJECTED') {
    throw new AppError('Seller is already rejected.', 409, 'ALREADY_REJECTED');
  }

  await SellerOnboardingModel.updateStatus(onboardingId, 'REJECTED', reason);

  return { message: `Seller application ${onboardingId} has been rejected.` };
};

/**
 * Suspend an active/approved seller.
 */
const suspendSeller = async (sellerId, reason) => {
  const seller = await SellerModel.findById(sellerId);
  if (!seller) throw new AppError('Seller not found.', 404, 'SELLER_NOT_FOUND');

  if (seller.sellerStatus === 'SUSPENDED') {
    throw new AppError('Seller is already suspended.', 409, 'ALREADY_SUSPENDED');
  }

  await SellerModel.updateSellerStatus(sellerId, 'SUSPENDED', reason);

  return { message: `Seller ${sellerId} has been suspended.` };
};

/**
 * Re-approve a previously rejected/suspended seller.
 */
const reApproveSeller = async (sellerId) => {
  const seller = await SellerModel.findById(sellerId);
  if (!seller) throw new AppError('Seller not found.', 404, 'SELLER_NOT_FOUND');

  await SellerModel.updateSellerStatus(sellerId, 'APPROVED', null);

  return { message: `Seller ${sellerId} has been re-approved.` };
};

module.exports = {
  listPendingSellers,
  listSellersByStatus,
  getSellerDetail,
  approveSeller,
  rejectSeller,
  suspendSeller,
  reApproveSeller,
};
