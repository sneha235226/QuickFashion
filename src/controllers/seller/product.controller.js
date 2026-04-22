const productService = require('../../services/seller/product.service');
const response = require('../../utils/response');
const AppError = require('../../utils/AppError');
const { addProductSchema, updateProductSchema } = require('../../validators/seller/product.validator');

// ─── Single Product CRUD ──────────────────────────────────────────────────────

/**
 * POST /api/seller/catalogs/:catalogId/products
 * Body: { productName?, price, stock, mrp?, returnPrice?, hsn?, gstRate?, weight?, styleCode?, variantAttributes? }
 * SKU is always backend-generated.
 */
const add = async (req, res, next) => {
  try {
    const { error, value } = addProductSchema.validate(req.body, { abortEarly: false });
    if (error) return response.validationError(res, error);

    const product = await productService.addProduct(
      parseInt(req.params.catalogId, 10),
      req.seller.id,
      value
    );
    return response.created(res, 'Product added.', { product });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/seller/catalogs/:catalogId/products/:productId
 */
const getOne = async (req, res, next) => {
  try {
    const product = await productService.getProduct(
      parseInt(req.params.productId, 10),
      parseInt(req.params.catalogId, 10),
      req.seller.id
    );
    return response.success(res, 'Product retrieved.', { product });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/seller/catalogs/:catalogId/products/:productId
 * Body: any subset of product fields + optional variantAttributes array
 */
const update = async (req, res, next) => {
  try {
    const { error, value } = updateProductSchema.validate(req.body, { abortEarly: false });
    if (error) return response.validationError(res, error);

    const product = await productService.updateProduct(
      parseInt(req.params.productId, 10),
      parseInt(req.params.catalogId, 10),
      req.seller.id,
      value
    );
    return response.success(res, 'Product updated.', { product });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/seller/catalogs/:catalogId/products/:productId
 */
const remove = async (req, res, next) => {
  try {
    await productService.deleteProduct(
      parseInt(req.params.productId, 10),
      parseInt(req.params.catalogId, 10),
      req.seller.id
    );
    return response.success(res, 'Product deleted.');
  } catch (err) {
    next(err);
  }
};

// ─── Product Images ───────────────────────────────────────────────────────────

/**
 * POST /api/seller/catalogs/:catalogId/products/:productId/images
 * Multipart fields: FRONT, BACK, SIDE, ZOOMED  (any subset)
 * Images are stored on S3; URLs saved to ProductImage table.
 */
const uploadImages = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      throw new AppError('No images uploaded.', 400, 'NO_IMAGES');
    }

    const product = await productService.uploadImages(
      parseInt(req.params.productId, 10),
      parseInt(req.params.catalogId, 10),
      req.seller.id,
      req.files
    );
    return response.success(res, 'Image(s) uploaded.', { product });
  } catch (err) {
    next(err);
  }
};



module.exports = { add, getOne, update, remove, uploadImages };
