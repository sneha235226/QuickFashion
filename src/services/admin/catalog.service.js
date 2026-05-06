const CatalogModel = require('../../models/catalog');
const AppError = require('../../utils/AppError');
const { getSignUrl } = require('../../utils/s3');

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
 * Get full catalog detail for admin review.
 */
const getCatalogDetail = async (catalogId) => {
  const catalog = await CatalogModel.findById(catalogId);
  if (!catalog) throw new AppError('Catalog not found.', 404, 'NOT_FOUND');
  await _signCatalogUrls(catalog);
  return catalog;
};

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
  return CatalogModel.update(catalogId, { status: 'DRAFT', rejectionNote: reason });
};

module.exports = {
  listPendingCatalogs,
  getCatalogDetail,
  approveCatalog,
  rejectCatalog,
};
