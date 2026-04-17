const adminCatalogService = require('../../services/admin/catalog.service');
const response            = require('../../utils/response');
const { rejectCatalogSchema } = require('../../validators/seller/catalog.validator');

/**
 * GET /api/admin/catalogs/pending
 */
const listPending = async (req, res, next) => {
  try {
    const catalogs = await adminCatalogService.listPendingCatalogs();
    return response.success(res, `${catalogs.length} catalog(s) pending review.`, { catalogs });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/catalogs/:id
 */
const getDetail = async (req, res, next) => {
  try {
    const catalog = await adminCatalogService.getCatalogDetail(parseInt(req.params.id, 10));
    return response.success(res, 'Catalog details retrieved.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/catalogs/:id/approve
 */
const approve = async (req, res, next) => {
  try {
    const catalog = await adminCatalogService.approveCatalog(parseInt(req.params.id, 10));
    return response.success(res, 'Catalog approved.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/catalogs/:id/reject
 * Body: { reason }
 */
const reject = async (req, res, next) => {
  try {
    const { error, value } = rejectCatalogSchema.validate(req.body, { abortEarly: false });
    if (error) return response.validationError(res, error);
    const catalog = await adminCatalogService.rejectCatalog(parseInt(req.params.id, 10), value.reason);
    return response.success(res, 'Catalog rejected and returned to seller for revision.', { catalog });
  } catch (err) {
    next(err);
  }
};

module.exports = { listPending, getDetail, approve, reject };
