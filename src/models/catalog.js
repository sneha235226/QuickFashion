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

const findBySeller = async (sellerId, filters = {}) => {
  // Backwards compatibility for when filters was just a status string
  if (typeof filters === 'string') {
    filters = { tab: 'all', status: filters };
  }

  const { tab = 'active', stockFilter = 'all', categoryId, status } = filters;
  const where = { sellerId, status: { not: 'DISCARDED' } };

  // 1. Tab Filters
  switch (tab.toLowerCase()) {
    case 'active':
      where.status = 'APPROVED';
      break;
    case 'activation_pending':
    case 'pending':
      where.status = 'SUBMITTED';
      break;
    case 'blocked':
      where.status = { in: ['REJECTED', 'BLOCKED'] };
      break;
    case 'paused':
      where.status = 'PAUSED';
      break;
    case 'draft':
      where.status = 'DRAFT';
      break;
    case 'all':
    default:
      if (status && status.toLowerCase() !== 'all') {
         where.status = status.toUpperCase();
      }
      break;
  }

  // 2. Category Filter
  if (categoryId) {
    where.categoryId = parseInt(categoryId, 10);
  }

  // 3. Stock Filter
  if (stockFilter && stockFilter.toLowerCase() !== 'all') {
    if (stockFilter.toLowerCase() === 'out_of_stock') {
      where.products = { some: { stock: 0 } };
    } else if (stockFilter.toLowerCase() === 'low_stock') {
      where.products = { some: { stock: { gt: 0, lte: 5 } } };
    }
  }

  const [catalogs, activeCount, pendingCount, blockedCount, pausedCount] = await prisma.$transaction([
    prisma.catalog.findMany({
      where,
      select: {
        id: true, brandName: true, status: true, createdAt: true, rejectionNote: true,
        category: { select: { id: true, name: true } },
        products: { 
          select: { 
            id: true, sku: true, stock: true, productName: true, price: true, mrp: true,
            attributeValues: {
              include: { attribute: { select: { name: true } } }
            },
            images: { select: { url: true, imageType: true } }
          } 
        },
        _count: { select: { products: true, documents: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.catalog.count({ where: { sellerId, status: 'APPROVED' } }),
    prisma.catalog.count({ where: { sellerId, status: 'SUBMITTED' } }),
    prisma.catalog.count({ where: { sellerId, status: { in: ['REJECTED', 'BLOCKED'] } } }),
    prisma.catalog.count({ where: { sellerId, status: 'PAUSED' } })
  ]);

  return { catalogs, counts: { active: activeCount, pending: pendingCount, blocked: blockedCount, paused: pausedCount } };
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

