const catalogService = require('../../services/seller/catalog.service');
const response = require('../../utils/response');
const AppError = require('../../utils/AppError');
const { unifiedCatalogSchema } = require('../../validators/seller/catalog.validator');
const CategoryModel = require('../../models/category');

/**
 * GET /api/seller/catalog
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
 * GET /api/seller/catalog/:catalogId
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
 * POST /api/seller/catalog/:catalogId/discard
 */
const discard = async (req, res, next) => {
  try {
    const catalog = await catalogService.discardCatalog(parseInt(req.params.catalogId, 10), req.seller.id);
    return response.success(res, 'Catalog discarded.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * Helper — parse multipart fields and extract image URLs + document URL.
 */
const _parseMultipartCatalog = (req) => {
  let payload;

  // Case 1: Data is a JSON string in req.body.data (Standard for multipart with large blobs)
  if (req.body.data) {
    try {
      payload = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } catch (e) {
      throw new AppError('Invalid JSON in "data" field.', 400, 'INVALID_JSON');
    }
  }
  // Case 2: Body itself is the payload (Typical if client sends JSON + files differently or no data wrapper)
  else if (req.body.categoryId || req.body.catalogId) {
    payload = req.body;
  }
  else {
    throw new AppError('Catalog data is required. Provide a "data" JSON field or direct JSON body.', 400, 'NO_DATA');
  }

  // Collect image URLs from S3
  const IMAGE_FIELDS = ['FRONT', 'BACK', 'SIDE', 'ZOOMED'];
  const imageUrls = [];
  // req.files is populated by multer.fields()
  if (req.files) {
    for (const field of IMAGE_FIELDS) {
      if (req.files[field] && req.files[field][0]) {
        imageUrls.push(req.files[field][0].location);
      }
    }
  }

  // Collect document URL
  let docUrl = null;
  if (req.files && req.files.document && req.files.document[0]) {
    docUrl = req.files.document[0].location;
  }

  return { payload, imageUrls, docUrl };
};

/**
 * POST /api/seller/catalog/save-draft
 * Multipart: data (JSON string) + FRONT, BACK, SIDE, ZOOMED + document (optional)
 * Saves catalog as DRAFT — partial data is OK.
 */
const saveDraft = async (req, res, next) => {
  try {
    const { payload, imageUrls, docUrl } = _parseMultipartCatalog(req);
    const catalog = await catalogService.processUnifiedCatalog(
      req.seller.id, payload, imageUrls, docUrl, 'DRAFT'
    );
    return response.created(res, 'Catalog saved as draft.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/catalog/submit
 * Multipart: data (JSON string) + FRONT, BACK, SIDE, ZOOMED + document (optional)
 * Validates fully and submits for admin review.
 */
const submitForReview = async (req, res, next) => {
  try {
    const { payload, imageUrls, docUrl } = _parseMultipartCatalog(req);

    // Strict validation for submission
    const { error, value } = unifiedCatalogSchema.validate(payload, { abortEarly: false });
    if (error) return response.validationError(res, error);

    const catalog = await catalogService.processUnifiedCatalog(
      req.seller.id, value, imageUrls, docUrl, 'SUBMITTED'
    );
    return response.created(res, 'Catalog submitted for admin review.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/catalog/upload-image
 * Standalone image upload. Returns the S3 location.
 */
const uploadImage = async (req, res, next) => {
  try {
    const imageUrls = {};
    if (req.files) {
      const IMAGE_FIELDS = ['FRONT', 'BACK', 'SIDE', 'ZOOMED'];
      for (const field of IMAGE_FIELDS) {
        if (req.files[field] && req.files[field][0]) {
          imageUrls[field] = req.files[field][0].location;
        }
      }
    }

    if (Object.keys(imageUrls).length === 0) {
      throw new AppError('No images uploaded.', 400, 'NO_IMAGES');
    }

    return response.success(res, 'Image(s) uploaded.', { imageUrls });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  getOne,
  discard,
  saveDraft,
  submitForReview,
  uploadImage,
};
