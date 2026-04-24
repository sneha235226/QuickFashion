/**
 * Catalog Model — data access for Catalog and BrandDocument
 */

const prisma = require('../config/database');

const CATALOG_FULL_INCLUDE = {
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

const findBySeller = (sellerId) =>
  prisma.catalog.findMany({
    where: { sellerId, status: { not: 'DISCARDED' } },
    select: {
      id: true, brandName: true, status: true, createdAt: true,
      category: { select: { id: true, name: true } },
      _count: { select: { products: true, documents: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

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

module.exports = {
  create,
  findById,
  findByIdRaw,
  findBySeller,
  update,
  countProducts,
  upsertCommonAttributes,
  findPendingForAdmin,
  addDocument,
  findDocumentById,
  deleteDocument,
  countDocuments,
};

