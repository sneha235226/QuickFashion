const CatalogModel = require('../../models/catalog');
const AppError = require('../../utils/AppError');
const { getSignUrl } = require('../../utils/s3');

/**
 * Helper — recursively sign all URLs in a catalog object.
 */
const _signCatalogUrls = async (catalog) => {
  if (!catalog) return;

  // Sign product images
  if (catalog.products) {
    for (const product of catalog.products) {
      if (product.images) {
        for (const img of product.images) {
          if (img.url) img.url = await getSignUrl(img.url);
        }
      }
    }
  }

  // Sign brand documents
  if (catalog.documents) {
    for (const doc of catalog.documents) {
      if (doc.documentUrl) doc.documentUrl = await getSignUrl(doc.documentUrl);
    }
  }
};

/**
 * List all catalogs awaiting admin review.
 */
const listPendingCatalogs = async () => {
  const catalogs = await CatalogModel.findPendingForAdmin();
  for (const catalog of catalogs) {
    await _signCatalogUrls(catalog);
  }
  return catalogs;
};

/**
 * List all catalogs, optionally filtered by status.
 */
const listAllCatalogs = async (status) => {
  const catalogs = await CatalogModel.findAllByStatus(status || null);
  for (const catalog of catalogs) {
    await _signCatalogUrls(catalog);
  }
  return catalogs;
};

/**
 * Get catalog stats for admin dashboard badges
 */
const getCatalogStats = async () => {
  const stats = await CatalogModel.getStatsForAdmin();
  
  // Format the array into an object { SUBMITTED: 5, APPROVED: 10, ... }
  const formattedStats = {
    SUBMITTED: 0,
    APPROVED: 0,
    REJECTED: 0,
    ALL: 0
  };
  
  stats.forEach(s => {
    if (formattedStats[s.status] !== undefined) {
      formattedStats[s.status] = s._count._all;
      formattedStats.ALL += s._count._all;
    }
  });
  
  return formattedStats;
};

/**
 * Get full catalog detail for admin review.
 */
const getCatalogDetail = async (catalogId) => {
  const catalog = await CatalogModel.findById(catalogId);
  if (!catalog || catalog.status === 'DRAFT') {
    throw new AppError('Catalog not found or is still in draft.', 404, 'NOT_FOUND');
  }
  await _signCatalogUrls(catalog);
  return catalog;
};

/**
 * Approve a catalog — moves it to APPROVED and makes products visible.
 */
const approveCatalog = async (catalogId) => {
  const catalog = await CatalogModel.findByIdRaw(catalogId);
  if (!catalog) throw new AppError('Catalog not found.', 404, 'NOT_FOUND');
  if (catalog.status !== 'SUBMITTED') {
    throw new AppError('Only catalogs in SUBMITTED status can be approved.', 400, 'INVALID_STATUS');
  }
  return CatalogModel.update(catalogId, { status: 'APPROVED', rejectionNote: null });
};

/**
 * Reject a catalog — moves it back to DRAFT with a rejection note.
 * Seller can edit and resubmit.
 */
const rejectCatalog = async (catalogId, reason) => {
  const catalog = await CatalogModel.findByIdRaw(catalogId);
  if (!catalog) throw new AppError('Catalog not found.', 404, 'NOT_FOUND');
  if (catalog.status !== 'SUBMITTED') {
    throw new AppError('Only catalogs in SUBMITTED status can be rejected.', 400, 'INVALID_STATUS');
  }
  return CatalogModel.update(catalogId, { status: 'REJECTED', rejectionNote: reason });
};

module.exports = {
  listPendingCatalogs,
  listAllCatalogs,
  getCatalogDetail,
  approveCatalog,
  rejectCatalog,
  getCatalogStats,
};
