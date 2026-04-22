const catalogService = require('../../services/seller/catalog.service');
const response = require('../../utils/response');
const AppError = require('../../utils/AppError');
const { createCatalogSchema, saveCatalogSchema, unifiedCatalogSchema, finalSubmissionSchema } = require('../../validators/seller/catalog.validator');
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
 * POST /api/seller/catalogs/unified
 * Body: { categoryId, brandName?, commonAttributes[], products[], brandDocuments[] }
 * Creates, populates, and submits a catalog for approval in one call.
 */
const createUnified = async (req, res, next) => {
  try {
    const { error, value } = unifiedCatalogSchema.validate(req.body, { abortEarly: false });
    if (error) return response.validationError(res, error);

    const catalog = await catalogService.createUnifiedCatalog(req.seller.id, value);
    return response.created(res, 'Catalog uploaded and submitted for admin review.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/catalogs/unified/multipart
 * Body (Multipart): 
 *   - data: JSON string (categoryId, brandName, commonAttributes, products[])
 *   - FRONT, BACK, SIDE, ZOOMED: physical image files
 */
const createUnifiedMultipart = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      throw new AppError('Product images are required (FRONT, BACK, SIDE, ZOOMED).', 400, 'NO_IMAGES');
    }

    if (!req.body.data) {
      throw new AppError('Catalog data is required as a JSON string in the "data" field.', 400, 'NO_DATA');
    }

    // 1. Parse JSON data from field
    let payload;
    try {
      payload = JSON.parse(req.body.data);
    } catch (e) {
      throw new AppError('Invalid JSON in "data" field.', 400, 'INVALID_JSON');
    }

    // 2. Validate using the same schema
    const { error, value } = unifiedCatalogSchema.validate(payload, { abortEarly: false });
    if (error) return response.validationError(res, error);

    // 3. Map physical files to product image URLs
    const VALID_TYPES = ['FRONT', 'BACK', 'SIDE', 'ZOOMED'];
    const uploadedImages = [];

    for (const type of VALID_TYPES) {
      if (req.files[type] && req.files[type][0]) {
        uploadedImages.push({
          imageType: type,
          url: req.files[type][0].location // Multer-S3 provide location
        });
      }
    }

    if (uploadedImages.length < 4) {
      throw new AppError('All 4 image types (FRONT, BACK, SIDE, ZOOMED) are required.', 400, 'MISSING_IMAGES');
    }

    // 4. Attach image URLs to every product in the catalog
    value.products.forEach(p => {
      p.images = uploadedImages;
    });

    // 5. Call existing service
    const catalog = await catalogService.createUnifiedCatalog(req.seller.id, value);
    return response.created(res, 'Catalog (with images) uploaded and submitted.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/catalogs/submit
 * Consolidated single-request submission (Key-Value based)
 */
const submitFinal = async (req, res, next) => {
  try {
    const { error, value } = finalSubmissionSchema.validate(req.body, { abortEarly: false });
    if (error) return response.validationError(res, error);

    const catalog = await catalogService.submitFinalCatalog(req.seller.id, value);

    return response.created(res, 'Catalog submitted successfully for review.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/catalog/submit/multipart
 * Multipart version of consolidated submission
 * Fields: data (JSON string), FRONT, BACK, SIDE, ZOOMED (Files)
 */
const submitFinalMultipart = async (req, res, next) => {
  try {
    if (!req.body.data) throw new AppError('data field (JSON) is required.', 400, 'BAD_REQUEST');

    let payload;
    try {
      payload = JSON.parse(req.body.data);
    } catch (e) {
      throw new AppError('Invalid JSON in data field.', 400, 'INVALID_JSON');
    }

    const { error, value } = finalSubmissionSchema.validate(payload, { abortEarly: false });
    if (error) return response.validationError(res, error);

    // Collect image URLs from S3 upload results
    const imageUrls = [];
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(f => imageUrls.push(f.location));
    } else if (req.files) {
      // For multer-s3 with fields or array
      ['FRONT', 'BACK', 'SIDE', 'ZOOMED'].forEach(fieldName => {
        if (req.files[fieldName]) {
          req.files[fieldName].forEach(f => imageUrls.push(f.location));
        }
      });
    }

    // Overwrite images in payload with the actual uploaded URLs
    if (imageUrls.length > 0) {
      value.images = imageUrls;
    } else if (!value.images || value.images.length === 0) {
      throw new AppError('At least one image must be uploaded or provided as a URL.', 400, 'NO_IMAGES');
    }

    const catalog = await catalogService.submitFinalCatalog(req.seller.id, value);

    return response.success(res, 'Catalog (with physical images) submitted successfully.', { catalog });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/seller/catalogs/brand/upload
 * Multipart fields: brandName, document
 */
const uploadBrandStandalone = async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('Brand document file is required.', 400, 'NO_FILE');
    if (!req.body.brandName) throw new AppError('brandName is required.', 400, 'NO_BRAND');

    // Link it to a new DRAFT catalog for this brand
    // This allows the brand to be verified even before products are added
    const catalog = await catalogService.createCatalog(req.seller.id, {
      categoryId: null, // Stub catalog for brand verification
      brandName: req.body.brandName
    });

    const document = await catalogService.addDocument(catalog.id, req.seller.id, {
      documentUrl: req.file.location,
      documentType: 'TRADEMARK' // Default or dynamic
    });

    return response.created(res, 'Brand document uploaded successfully.', {
      catalogId: catalog.id,
      brandName: req.body.brandName,
      document
    });
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



module.exports = {
  create,
  list,
  getOne,
  save,
  submit,
  discard,
  uploadDocument,
  deleteDocument,
  createUnified,
  createUnifiedMultipart,
  submitFinal,
  submitFinalMultipart,
  uploadBrandStandalone,
};
