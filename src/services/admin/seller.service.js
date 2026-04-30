const SellerModel = require('../../models/seller');
const SellerOnboardingModel = require('../../models/seller_onboarding');
const AppError = require('../../utils/AppError');
const { decrypt } = require('../../utils/crypto');
const { getSignUrl } = require('../../utils/s3');

/**
 * Helper — recursively sign all URLs in a seller/onboarding object.
 */
const _signSellerUrls = async (seller) => {
  if (!seller) return;

  // Sign GST Document in businessDetails
  if (seller.businessDetails?.gstDocumentUrl) {
    seller.businessDetails.gstDocumentUrl = await getSignUrl(seller.businessDetails.gstDocumentUrl);
  }

  // Sign GST Document in legacy structure (onboarding)
  if (seller.businessDetails?.gstDocument) {
    seller.businessDetails.gstDocument = await getSignUrl(seller.businessDetails.gstDocument);
  }
};

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

  return SellerModel.listAllSellers(status);
};

/**
 * List all sellers.
 */
const listAllSellers = async (status = null) => {
  return SellerModel.listAllSellers(status);
};

/**
 * Get full seller details for the admin review panel.
 */
/**
 * Get full seller details for the admin review panel.
 */
const getSellerDetail = async (id) => {
  // Try finding in active sellers first
  const seller = await SellerModel.getSellerDetailForAdmin(id);
  if (seller) {
    // Transform relations to match the "basicDetails/businessDetails/bankDetails" structure the UI expects
    const detail = {
      id: seller.id,
      phone: seller.mobile,
      status: seller.sellerStatus,
      createdAt: seller.createdAt,
      rejectionReason: seller.rejectionReason,
      basicDetails: {
        firstName: seller.name?.split(' ')[0] || "",
        lastName: seller.name?.split(' ').slice(1).join(' ') || "",
        email: seller.email,
        gender: seller.gender,
        sellerType: seller.sellerType,
      },
      businessDetails: {
        businessName: seller.businessDetails?.businessName,
        ownerName: seller.businessDetails?.ownerName,
        businessEmail: seller.businessDetails?.businessEmail,
        businessPhone: seller.businessDetails?.businessPhone,
        businessType: seller.businessDetails?.businessType,
        storeType: seller.businessDetails?.storeType,
        sellerType: seller.sellerType, // Added this for redundancy
        gstNumber: seller.businessDetails?.gstin,
        gstDocument: seller.businessDetails?.gstDocumentUrl,
        productCategories: seller.businessDetails?.productCategories,
        address: {
          line1: seller.addresses?.[0]?.addressLine,
          line2: seller.addresses?.[0]?.addressLine2,
          landmark: seller.addresses?.[0]?.landmark,
          city: seller.addresses?.[0]?.city,
          state: seller.addresses?.[0]?.state,
          pincode: seller.addresses?.[0]?.pincode,
        }
      },
      bankDetails: {
        bankName: seller.bankDetails?.bankName,
        branchName: seller.bankDetails?.branch,
        IFSC: seller.bankDetails?.ifsc,
        accountHolderName: seller.bankDetails?.accountHolderName,
        accountNumber: decrypt(seller.bankDetails?.accountNumberEncrypted), 
      }
    };
    await _signSellerUrls(detail);
    return detail;
  }

  // Fallback to onboarding table
  const onboarding = await SellerOnboardingModel.findById(id);
  if (!onboarding) throw new AppError('Seller application not found.', 404, 'SELLER_NOT_FOUND');
  await _signSellerUrls(onboarding);
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
        gender: basicDetails.gender,
        sellerType: businessDetails.sellerType || "RETAILER",
        sellerStatus: 'APPROVED'
      }
    });

    await tx.businessDetails.create({
      data: {
        sellerId: newSeller.id,
        businessName: businessDetails.businessName,
        ownerName: businessDetails.ownerName,
        businessEmail: businessDetails.businessEmail,
        businessPhone: businessDetails.businessPhone,
        businessType: businessDetails.businessType,
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
        addressLine: businessDetails.address.line1,
        addressLine2: businessDetails.address.line2,
        landmark: businessDetails.address.landmark,
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
  listAllSellers,
  getSellerDetail,
  approveSeller,
  rejectSeller,
  suspendSeller,
  reApproveSeller,
};
