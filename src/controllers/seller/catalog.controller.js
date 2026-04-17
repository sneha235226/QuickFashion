const catalogService = require('../../services/seller/catalog.service');
const response = require('../../utils/response');
const AppError = require('../../utils/AppError');
const { createCatalogSchema, saveCatalogSchema } = require('../../validators/seller/catalog.validator');
const { generateBulkTemplate } = require('../../utils/templateGenerator');
const CategoryModel = require('../../models/category');

// ─── Catalog ──────────────────────────────────────────────────────────────────

/**
 * POST /api/seller/catalogs
 * Body: { categoryId }
 * Creates an empty DRAFT catalog. Fill it via /save.
 */
const create = async (req, res, next) => {
  try {
    const { error, value } = createCatalogSchema.validate(req.body, { abortEarly: false });
    if (error) return response.validationError(res, error);
    const catalog = await catalogService.createCatalog(req.seller.id, value);
    return response.created(res, 'Catalog created in DRAFT. Use /save to add products and attributes.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/seller/catalogs
 */
const list = async (req, res, next) => {
  try {
    const catalogs = await catalogService.listMyCatalogs(req.seller.id);
    return response.success(res, `${catalogs.length} catalog(s) found.`, { catalogs });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/seller/catalogs/:catalogId
 */
const getOne = async (req, res, next) => {
  try {
    const catalog = await catalogService.getCatalog(parseInt(req.params.catalogId, 10), req.seller.id);
    return response.success(res, 'Catalog retrieved.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/catalogs/:catalogId/save
 *
 * Save (or update) a DRAFT catalog. Can be called multiple times.
 * Replaces all common attributes and all products on each call.
 *
 * Body:
 * {
 *   "commonAttributes": [{ "attributeId": 1, "value": "Cotton" }],
 *   "products": [
 *     { "price": 599, "stock": 50, "variantAttributes": [{ "attributeId": 7, "value": "S" }] }
 *   ]
 * }
 */
const save = async (req, res, next) => {
  try {
    const { error, value } = saveCatalogSchema.validate(req.body, { abortEarly: false });
    if (error) return response.validationError(res, error);

    const catalog = await catalogService.saveCatalog(
      parseInt(req.params.catalogId, 10),
      req.seller.id,
      value
    );
    return response.success(res, 'Catalog saved.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/catalogs/:catalogId/submit
 */
const submit = async (req, res, next) => {
  try {
    const catalog = await catalogService.submitCatalog(parseInt(req.params.catalogId, 10), req.seller.id);
    return response.success(res, 'Catalog submitted for admin review.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/catalogs/:catalogId/discard
 */
const discard = async (req, res, next) => {
  try {
    const catalog = await catalogService.discardCatalog(parseInt(req.params.catalogId, 10), req.seller.id);
    return response.success(res, 'Catalog discarded.', { catalog });
  } catch (err) {
    next(err);
  }
};

// ─── Brand Documents ──────────────────────────────────────────────────────────

/**
 * POST /api/seller/catalogs/:catalogId/documents
 * Multipart: field "document"
 */
const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No document file uploaded.', 400, 'NO_FILE');

    const documentType = req.body.documentType ?? 'OTHER';
    const validTypes = ['TRADEMARK', 'AUTHORIZATION_LETTER', 'INVOICE', 'OTHER'];
    if (!validTypes.includes(documentType)) {
      throw new AppError(`documentType must be one of: ${validTypes.join(', ')}.`, 400, 'INVALID_DOCUMENT_TYPE');
    }

    const documentUrl = req.file.location;
    const doc = await catalogService.addDocument(
      parseInt(req.params.catalogId, 10),
      req.seller.id,
      documentUrl,
      documentType
    );
    return response.created(res, 'Document uploaded.', { document: doc });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/seller/catalogs/:catalogId/documents/:documentId
 */
const deleteDocument = async (req, res, next) => {
  try {
    await catalogService.deleteDocument(
      parseInt(req.params.catalogId, 10),
      req.seller.id,
      parseInt(req.params.documentId, 10)
    );
    return response.success(res, 'Document deleted.');
  } catch (err) {
    next(err);
  }
};

// ─── Bulk Upload Template ─────────────────────────────────────────────────────

/**
 * GET /api/seller/catalogs/:catalogId/template
 */
const downloadTemplate = async (req, res, next) => {
  try {
    const catalog = await catalogService.getCatalog(parseInt(req.params.catalogId, 10), req.seller.id);
    const attributes = await CategoryModel.findAttributesFlatByCategoryId(catalog.categoryId);
    const buffer = generateBulkTemplate(catalog.category, attributes);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bulk_template_${catalog.category.slug}.xlsx"`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  create,
  list,
  getOne,
  save,
  submit,
  discard,
  uploadDocument,
  deleteDocument,
  downloadTemplate,
};
