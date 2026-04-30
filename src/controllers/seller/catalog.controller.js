const catalogService = require('../../services/seller/catalog.service');
const response = require('../../utils/response');
const AppError = require('../../utils/AppError');
const { unifiedCatalogSchema } = require('../../validators/seller/catalog.validator');
const CategoryModel = require('../../models/category');
const { getPublicUrl, getSignUrl } = require('../../utils/s3');

/**
 * GET /api/seller/catalog
 */
const list = async (req, res, next) => {
  try {
    const status = req.query.status || 'all';
    const catalogs = await catalogService.listMyCatalogs(req.seller.id, status);
    for (const catalog of catalogs) {
      await _signCatalogUrls(catalog);
    }
    return response.success(res, `${catalogs.length} catalog(s) found.`, { catalogs });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/seller/catalog/:catalogId/toggle-pause
 */
const togglePause = async (req, res, next) => {
  try {
    const catalog = await catalogService.togglePauseCatalog(parseInt(req.params.catalogId, 10), req.seller.id);
    return response.success(res, `Catalog ${catalog.status === 'PAUSED' ? 'paused' : 'unpaused'} successfully.`, { catalog });
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
    await _signCatalogUrls(catalog);
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
const _parseMultipartCatalog = async (req) => {
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
        // Persist the fixed public URL
        imageUrls.push(getPublicUrl(req.files[field][0].key));
      }
    }
  }

  // Collect document URL
  let docUrl = null;
  if (req.files && req.files.document && req.files.document[0]) {
    docUrl = getPublicUrl(req.files.document[0].key);
  }

  return { payload, imageUrls, docUrl };
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
 * POST /api/seller/catalog/save-draft
 * Multipart: data (JSON string) + FRONT, BACK, SIDE, ZOOMED + document (optional)
 * Saves catalog as DRAFT — partial data is OK.
 */
const saveDraft = async (req, res, next) => {
  try {
    const { payload, imageUrls, docUrl } = await _parseMultipartCatalog(req);
    const catalog = await catalogService.processUnifiedCatalog(
      req.seller.id, payload, imageUrls, docUrl, 'DRAFT'
    );
    await _signCatalogUrls(catalog);
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
    const { payload, imageUrls, docUrl } = await _parseMultipartCatalog(req);

    // Strict validation for submission
    const { error, value } = unifiedCatalogSchema.validate(payload, { abortEarly: false });
    if (error) return response.validationError(res, error);

    const catalog = await catalogService.processUnifiedCatalog(
      req.seller.id, value, imageUrls, docUrl, 'SUBMITTED'
    );
    await _signCatalogUrls(catalog);
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
          imageUrls[field] = await getSignUrl(req.files[field][0].key);
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

/**
 * PUT /api/seller/catalog/:catalogId
 * Multipart: data (JSON string) + FRONT, BACK, SIDE, ZOOMED + document (optional)
 * Updates the catalog details while preserving its current status unless specified.
 */
const update = async (req, res, next) => {
  try {
    const { payload, imageUrls, docUrl } = await _parseMultipartCatalog(req);
    
    const catalogId = parseInt(req.params.catalogId, 10);
    payload.catalogId = catalogId;
    
    // Get existing catalog to determine current status
    const existingCatalog = await catalogService.getCatalog(catalogId, req.seller.id);
    let targetStatus = payload.status || existingCatalog.status;

    // If an approved or rejected catalog is edited, it must go through admin review again
    if (existingCatalog.status === 'APPROVED' || existingCatalog.status === 'REJECTED') {
      targetStatus = 'SUBMITTED';
    }

    if (targetStatus === 'SUBMITTED') {
      const { error, value } = unifiedCatalogSchema.validate(payload, { abortEarly: false });
      if (error) return response.validationError(res, error);
      payload.categoryId = value.categoryId; // ensuring validated types
    }
    
    // Fallback if categoryId is not provided in payload but we have it from existing
    if (!payload.categoryId) {
      payload.categoryId = existingCatalog.categoryId;
    }

    const catalog = await catalogService.processUnifiedCatalog(
      req.seller.id, payload, imageUrls, docUrl, targetStatus
    );
    await _signCatalogUrls(catalog);
    return response.success(res, 'Catalog updated successfully.', { catalog });
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
  update,
  togglePause,
};
