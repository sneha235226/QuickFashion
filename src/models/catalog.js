/**
 * Catalog Model — data access for Catalog and BrandDocument
 */

const prisma = require('../config/database');

const CATALOG_FULL_INCLUDE = {
  seller: {
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      sellerType: true,
      businessDetails: { select: { businessName: true, gstin: true } },
    },
  },
  category: { select: { id: true, name: true, slug: true } },
  commonAttributes: {
    include: {
      attribute: { select: { id: true, name: true, type: true, isVariant: true, groupType: true } },
    },
  },
  products: {
    include: {
      attributeValues: {
        include: {
          attribute: { select: { id: true, name: true, type: true, isVariant: true, groupType: true } },
        },
      },
      images: { orderBy: { imageType: 'asc' } },
    },
  },
  documents: true,
};

// ─── Catalog CRUD ────────────────────────────────────────────────────────────

const create = (data) =>
  prisma.catalog.create({ data });

const findById = (id) =>
  prisma.catalog.findUnique({
    where: { id },
    include: CATALOG_FULL_INCLUDE,
  });

const findByIdRaw = (id) =>
  prisma.catalog.findUnique({ where: { id } });

const findBySeller = async (sellerId, status = 'all') => {
  const where = { sellerId, status: { not: 'DISCARDED' } };

  if (status && status.toLowerCase() !== 'all') {
    let s = status.toUpperCase();
    if (s === 'PENDING') s = 'SUBMITTED';
    if (s === 'SUSPENDED') s = 'BLOCKED';
    where.status = s;
  }

  return prisma.catalog.findMany({
    where,
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { products: true, documents: true } },
      products: {
        take: 1,
        select: {
          images: {
            where: { imageType: 'FRONT' },
            take: 1,
            select: { url: true }
          }
        }
      }
    },
    orderBy: { updatedAt: 'desc' },
  });
};

const update = (id, data) =>
  prisma.catalog.update({ where: { id }, data });

const countProducts = (catalogId) =>
  prisma.product.count({ where: { catalogId } });

// ─── Admin review ────────────────────────────────────────────────────────────

const findPendingForAdmin = () =>
  prisma.catalog.findMany({
    where: { status: 'SUBMITTED' },
    include: {
      seller: { select: { id: true, mobile: true, businessDetails: { select: { businessName: true } } } },
      category: { select: { id: true, name: true } },
      _count: { select: { products: true, documents: true } },
    },
    orderBy: { updatedAt: 'asc' },
  });

const findAllByStatus = (status) => {
  // Admin should never see drafts. If status is provided, use it, but if it's 'DRAFT', force no results.
  // If no status is provided (All tab), exclude DRAFT.
  let where = {};
  if (status === 'DRAFT') {
    where = { id: -1 }; // Force empty
  } else if (status) {
    where = { status };
  } else {
    where = { status: { not: 'DRAFT' } };
  }

  return prisma.catalog.findMany({
    where,
    include: {
      seller: { select: { id: true, mobile: true, name: true, businessDetails: { select: { businessName: true } } } },
      category: { select: { id: true, name: true } },
      _count: { select: { products: true, documents: true } },
      products: {
        take: 1,
        select: {
          images: { where: { imageType: 'FRONT' }, take: 1, select: { url: true } },
          price: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
};

// ─── CatalogAttributeValue (common attributes) ───────────────────────────────

/**
 * Upsert all common attribute values for a catalog in one transaction.
 * Replaces everything — caller passes the full desired set.
 */
const upsertCommonAttributes = (catalogId, values) =>
  prisma.$transaction([
    prisma.catalogAttributeValue.deleteMany({ where: { catalogId } }),
    ...values.map((v) =>
      prisma.catalogAttributeValue.create({
        data: { catalogId, attributeId: v.attributeId, value: String(v.value) },
      })
    ),
  ]);

// ─── BrandDocument ───────────────────────────────────────────────────────────

const addDocument = (catalogId, documentUrl, documentType) =>
  prisma.brandDocument.create({
    data: { catalogId, documentUrl, documentType },
  });

const findDocumentById = (id) =>
  prisma.brandDocument.findUnique({ where: { id } });

const deleteDocument = (id) =>
  prisma.brandDocument.delete({ where: { id } });

const countDocuments = (catalogId) =>
  prisma.brandDocument.count({ where: { catalogId } });

const getStatsForAdmin = () =>
  prisma.catalog.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: { status: { not: 'DRAFT' } }
  });

module.exports = {
  create,
  findById,
  findByIdRaw,
  findBySeller,
  update,
  countProducts,
  upsertCommonAttributes,
  findPendingForAdmin,
  findAllByStatus,
  addDocument,
  findDocumentById,
  deleteDocument,
  countDocuments,
  getStatsForAdmin,
};

