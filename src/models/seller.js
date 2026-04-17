/**
 * Seller Model — data access layer for all seller-related tables.
 * Services call these methods. Prisma is never imported outside this file.
 *
 * Tables covered:
 *   Seller · OTP · BusinessDetails · Address · BankDetails · SupplierProfile
 */

const prisma = require('../config/database');

// ─── Seller ───────────────────────────────────────────────────────────────────

const findByMobile = (mobile) =>
  prisma.seller.findUnique({ where: { mobile } });

const findById = (id) =>
  prisma.seller.findUnique({ where: { id } });

const findByIdSelect = (id, select) =>
  prisma.seller.findUnique({ where: { id }, select });

/**
 * Creates seller if mobile is new, does nothing if already exists.
 */
const upsertByMobile = (mobile) =>
  prisma.seller.upsert({
    where: { mobile },
    update: {},
    create: { mobile },
  });

const create = (data) =>
  prisma.seller.create({ data });

const updateSeller = (id, data) =>
  prisma.seller.update({ where: { id }, data });

const updateRefreshToken = (id, refreshToken) =>
  prisma.seller.update({
    where: { id },
    data: { refreshToken },
  });

// ─── BusinessDetails ──────────────────────────────────────────────────────────

const findBusinessByGstin = (gstin) =>
  prisma.businessDetails.findUnique({ where: { gstin } });

const findBusinessBySeller = (sellerId) =>
  prisma.businessDetails.findUnique({ where: { sellerId } });

const upsertBusiness = (sellerId, data) =>
  prisma.businessDetails.upsert({
    where: { sellerId },
    update: data,
    create: { sellerId, ...data },
  });

// ─── Address ─────────────────────────────────────────────────────────────────

const countAddresses = (sellerId, type) =>
  prisma.address.count({ where: { sellerId, type } });

/**
 * Create address. If isDefault, unset all existing defaults of same type first.
 * Transaction prevents race conditions when two requests arrive simultaneously.
 */
const createAddressTransaction = (sellerId, addressData, shouldBeDefault) =>
  prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.address.updateMany({
        where: { sellerId, type: addressData.type, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.address.create({
      data: { sellerId, ...addressData, isDefault: shouldBeDefault },
    });
  });

const findAddressById = (id, sellerId) =>
  prisma.address.findFirst({ where: { id, sellerId } });

const findAllAddresses = (sellerId) =>
  prisma.address.findMany({
    where: { sellerId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

/**
 * Set one address as default — unsets all others of same type atomically.
 */
const setDefaultAddressTransaction = (sellerId, addressId, type) =>
  prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: { sellerId, type, isDefault: true },
      data: { isDefault: false },
    });
    return tx.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  });

const deleteAddressById = (id) =>
  prisma.address.delete({ where: { id } });

// ─── BankDetails ──────────────────────────────────────────────────────────────

/**
 * Used to detect duplicate bank accounts without storing plaintext.
 */
// findBankByHmac removed because field does not exist in schema

const findBankBySeller = (sellerId) =>
  prisma.bankDetails.findUnique({ where: { sellerId } });

const upsertBank = (sellerId, data) =>
  prisma.bankDetails.upsert({
    where: { sellerId },
    update: data,
    create: { sellerId, ...data },
  });

// ─── SupplierProfile ──────────────────────────────────────────────────────────

// SupplierProfile methods removed because model does not exist in schema

// ─── Admin approval ───────────────────────────────────────────────────────────

/**
 * List all sellers pending admin approval (onboarding COMPLETED, status PENDING).
 */
const listPendingSellers = () =>
  prisma.seller.findMany({
    where: {
      sellerStatus: 'PENDING',
    },
    select: {
      id: true,
      mobile: true,
      sellerStatus: true,
      createdAt: true,
      businessDetails: { select: { businessName: true, businessType: true, gstin: true } },
    },
    orderBy: { createdAt: 'asc' }, // oldest first — review in order
  });

/**
 * Full seller detail for admin review panel.
 */
const getSellerDetailForAdmin = (sellerId) =>
  prisma.seller.findUnique({
    where: { id: sellerId },
    select: {
      id: true,
      mobile: true,
      sellerStatus: true,
      rejectionReason: true,
      createdAt: true,
      businessDetails: true,
      addresses: { where: { isDefault: true } },
      bankDetails: { select: { bankName: true, branch: true, ifsc: true, accountHolderName: true, verified: true } },
    },
  });

const updateSellerStatus = (sellerId, sellerStatus, rejectionReason = null) =>
  prisma.seller.update({
    where: { id: sellerId },
    data: { sellerStatus, rejectionReason },
  });

// ─── Full onboarding snapshot ─────────────────────────────────────────────────

const getOnboardingSnapshot = (sellerId) =>
  prisma.seller.findUnique({
    where: { id: sellerId },
    select: {
      id: true,
      mobile: true,
      businessDetails: {
        select: { businessName: true, businessType: true, gstin: true },
      },
      addresses: {
        select: { id: true, fullName: true, city: true, state: true, pincode: true, isDefault: true, type: true },
      },
      bankDetails: {
        select: { bankName: true, branch: true, ifsc: true, accountHolderName: true, verified: true },
      },
    },
  });

module.exports = {
  // Seller
  findByMobile,
  findById,
  findByIdSelect,
  create,
  upsertByMobile,
  updateSeller,
  updateRefreshToken,
  // BusinessDetails
  findBusinessByGstin,
  findBusinessBySeller,
  upsertBusiness,
  // Address
  countAddresses,
  createAddressTransaction,
  findAddressById,
  findAllAddresses,
  setDefaultAddressTransaction,
  deleteAddressById,
  // BankDetails
  findBankBySeller,
  upsertBank,
  // Snapshot
  getOnboardingSnapshot,
  // Admin approval
  listPendingSellers,
  getSellerDetailForAdmin,
  updateSellerStatus,
};
