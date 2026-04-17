const CatalogModel  = require('../../models/catalog');
const AppError      = require('../../utils/AppError');

/**
 * List all catalogs awaiting admin review.
 */
const listPendingCatalogs = () => CatalogModel.findPendingForAdmin();

/**
 * Get full catalog detail for admin review.
 */
const getCatalogDetail = async (catalogId) => {
  const catalog = await CatalogModel.findById(catalogId);
  if (!catalog) throw new AppError('Catalog not found.', 404, 'NOT_FOUND');
  return catalog;
};

/**
 * Approve a catalog — moves it to APPROVED and makes products visible.
 */
const approveCatalog = async (catalogId) => {
  const catalog = await CatalogModel.findByIdRaw(catalogId);
  if (!catalog) throw new AppError('Catalog not found.', 404, 'NOT_FOUND');
  if (catalog.status !== 'PENDING_APPROVAL') {
    throw new AppError('Only catalogs in PENDING_APPROVAL status can be approved.', 400, 'INVALID_STATUS');
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
  if (catalog.status !== 'PENDING_APPROVAL') {
    throw new AppError('Only catalogs in PENDING_APPROVAL status can be rejected.', 400, 'INVALID_STATUS');
  }
  return CatalogModel.update(catalogId, { status: 'DRAFT', rejectionNote: reason });
};

module.exports = {
  listPendingCatalogs,
  getCatalogDetail,
  approveCatalog,
  rejectCatalog,
};
