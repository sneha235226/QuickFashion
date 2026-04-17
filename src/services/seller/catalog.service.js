const CatalogModel = require('../../models/catalog');
const CategoryModel = require('../../models/category');
const ProductModel = require('../../models/product');
const AppError = require('../../utils/AppError');
const { generateUniqueSku } = require('../../utils/sku');

const MIN_PRODUCTS = 1;
const MAX_PRODUCTS = 9;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const assertOwnership = async (catalogId, sellerId, { requireDraft = false } = {}) => {
  const catalog = await CatalogModel.findByIdRaw(catalogId);
  if (!catalog) throw new AppError('Catalog not found.', 404, 'NOT_FOUND');
  if (catalog.sellerId !== sellerId) throw new AppError('Access denied.', 403, 'FORBIDDEN');
  if (requireDraft && catalog.status !== 'DRAFT') {
    throw new AppError('This catalog cannot be modified in its current status.', 400, 'NOT_EDITABLE');
  }
  return catalog;
};

/**
 * Validate + resolve a list of { attributeId, value } pairs.
 * scope: 'variant' | 'common' | 'all'
 */
const resolveAttributeValues = async (categoryId, inputs = [], scope = 'all') => {
  const allAttrs = await CategoryModel.findAttributesFlatByCategoryId(categoryId);

  const filtered = scope === 'variant' ? allAttrs.filter((a) => a.isVariant)
    : scope === 'common' ? allAttrs.filter((a) => !a.isVariant)
      : allAttrs;

  const attrMap = new Map(filtered.map((a) => [a.id, a]));
  const resolved = [];

  for (const { attributeId, value } of inputs) {
    const attr = attrMap.get(attributeId);
    if (!attr) {
      throw new AppError(
        `Attribute ID ${attributeId} is not valid for this category / scope.`,
        400, 'INVALID_ATTRIBUTE'
      );
    }
    if (attr.type === 'NUMBER' && isNaN(Number(value))) {
      throw new AppError(`"${attr.name}" must be a number.`, 400, 'INVALID_ATTRIBUTE_VALUE');
    }
    if (attr.type === 'SELECT') {
      const allowed = attr.options.map((o) => o.value.toLowerCase());
      if (!allowed.includes(String(value).toLowerCase())) {
        throw new AppError(
          `"${value}" is not valid for "${attr.name}". Allowed: ${attr.options.map((o) => o.value).join(', ')}.`,
          400, 'INVALID_ATTRIBUTE_VALUE'
        );
      }
    }
    resolved.push({ attributeId, value: String(value) });
  }

  return resolved;
};

// ─── Catalog lifecycle ────────────────────────────────────────────────────────

/**
 * Step 1 — Create an empty DRAFT catalog.
 * Only categoryId is required. Everything else filled via /save.
 */
const createCatalog = async (sellerId, { categoryId }) => {
  const category = await CategoryModel.findById(categoryId);
  if (!category) throw new AppError('Category not found.', 404, 'NOT_FOUND');
  if (!category.isLeaf) {
    throw new AppError('Please select the deepest category before creating a catalog.', 400, 'NOT_LEAF');
  }
  return CatalogModel.create({ sellerId, categoryId, status: 'DRAFT' });
};

const listMyCatalogs = (sellerId) => CatalogModel.findBySeller(sellerId);

const getCatalog = async (catalogId, sellerId) => {
  const catalog = await CatalogModel.findById(catalogId);
  if (!catalog) throw new AppError('Catalog not found.', 404, 'NOT_FOUND');
  if (catalog.sellerId !== sellerId) throw new AppError('Access denied.', 403, 'FORBIDDEN');
  return catalog;
};

/**
 * Step 4/6 — Save & Go Back (DRAFT save).
 *
 * Payload:
 * {
 *   brandName?: string,
 *
 *   // Group 2 (PRODUCT_DETAILS) + Group 3 (OTHER_ATTRIBUTES) — isVariant=false
 *   commonAttributes: [{ attributeId, value }],
 *
 *   // Group 1 rows — each row = one product variant
 *   products: [{
 *     productName, price, mrp, returnPrice, stock, hsn, gstRate, weight, styleCode,
 *     variantAttributes: [{ attributeId, value }]   // isVariant=true columns
 *   }]
 * }
 *
 * - SKU auto-generated per product on backend
 * - Existing products for this catalog are fully replaced on each save
 * - Idempotent — safe to call multiple times
 */
const saveCatalog = async (catalogId, sellerId, payload) => {
  const catalog = await assertOwnership(catalogId, sellerId, { requireDraft: true });

  const { brandName, commonAttributes = [], products = [] } = payload;

  if (products.length > MAX_PRODUCTS) {
    throw new AppError(`Maximum ${MAX_PRODUCTS} products per catalog.`, 400, 'PRODUCT_LIMIT');
  }

  // ── Brand name (optional) ──────────────────────────────────────────────────
  if (brandName !== undefined) {
    await CatalogModel.update(catalogId, { brandName: brandName || null });
  }

  // ── Common attributes (Group 2 + Group 3) ─────────────────────────────────
  if (commonAttributes.length > 0) {
    const resolvedCommon = await resolveAttributeValues(catalog.categoryId, commonAttributes, 'common');
    await CatalogModel.upsertCommonAttributes(catalogId, resolvedCommon);
  } else {
    // Explicit empty array = clear common attributes
    await CatalogModel.upsertCommonAttributes(catalogId, []);
  }

  // ── Products (variant rows) ────────────────────────────────────────────────
  await ProductModel.deleteByCatalogId(catalogId);

  for (const p of products) {
    const {
      productName, price, mrp, returnPrice,
      stock, hsn, gstRate, netWeight, styleCode,
      variantAttributes = [],
    } = p;

    const resolvedVariant = variantAttributes.length > 0
      ? await resolveAttributeValues(catalog.categoryId, variantAttributes, 'variant')
      : [];

    const sku = await generateUniqueSku(
      async (c) => !(await ProductModel.skuExistsForSeller(c, sellerId))
    );

    const product = await ProductModel.create(catalogId, {
      productName: productName ?? null,
      price,
      mrp: mrp ?? null,
      returnPrice: returnPrice ?? null,
      stock,
      sku,
      hsn: hsn ?? null,
      gstRate: gstRate ?? null,
      netWeight: netWeight ?? null,
      styleCode: styleCode ?? null,
    });

    if (resolvedVariant.length > 0) {
      await ProductModel.upsertAttributeValues(product.id, resolvedVariant);
    }
  }

  return CatalogModel.findById(catalogId);
};

/**
 * Step 5 — Submit for admin review.
 *
 * Validates:
 *   - DRAFT status
 *   - At least 1 product, max 9
 *   - At least 1 brand document
 *   - All required variant attributes present on every product
 *   - All required common attributes present
 *   - All 4 images uploaded per product (FRONT, BACK, SIDE, ZOOMED)
 */
const submitCatalog = async (catalogId, sellerId) => {
  const catalog = await CatalogModel.findById(catalogId);
  if (!catalog) throw new AppError('Catalog not found.', 404, 'NOT_FOUND');
  if (catalog.sellerId !== sellerId) throw new AppError('Access denied.', 403, 'FORBIDDEN');
  if (catalog.status !== 'DRAFT') {
    throw new AppError('Only DRAFT catalogs can be submitted.', 400, 'NOT_DRAFT');
  }

  const productCount = catalog.products.length;
  if (productCount < MIN_PRODUCTS) {
    throw new AppError('Add at least 1 product before submitting.', 400, 'NO_PRODUCTS');
  }
  if (productCount > MAX_PRODUCTS) {
    throw new AppError(`A catalog can have at most ${MAX_PRODUCTS} products.`, 400, 'TOO_MANY_PRODUCTS');
  }

  const docCount = await CatalogModel.countDocuments(catalogId);
  if (docCount === 0) {
    throw new AppError('Upload at least one brand document before submitting.', 400, 'NO_DOCUMENTS');
  }

  const allAttrs = await CategoryModel.findAttributesFlatByCategoryId(catalog.categoryId);
  const requiredCommon = allAttrs.filter((a) => a.isRequired && !a.isVariant);
  const requiredVariant = allAttrs.filter((a) => a.isRequired && a.isVariant);

  // Validate required common attributes
  if (requiredCommon.length > 0) {
    const providedIds = catalog.commonAttributes.map((v) => v.attributeId);
    const missing = requiredCommon.filter((a) => !providedIds.includes(a.id));
    if (missing.length > 0) {
      throw new AppError(
        `Missing required catalog attribute(s): ${missing.map((a) => a.name).join(', ')}.`,
        400, 'MISSING_REQUIRED_ATTRIBUTES'
      );
    }
  }

  const REQUIRED_IMAGES = ['FRONT', 'BACK', 'SIDE', 'ZOOMED'];

  for (const product of catalog.products) {
    // 1. Mandatory static fields (Group 1) — checked only on submission
    const requiredStatics = ['productName', 'price', 'mrp', 'stock', 'hsn', 'gstRate', 'netWeight'];
    const missingStatics = requiredStatics.filter((f) => product[f] === null || product[f] === undefined);

    if (missingStatics.length > 0) {
      throw new AppError(
        `Product (SKU: ${product.sku}) is missing required field(s): ${missingStatics.join(', ')}.`,
        400, 'MISSING_REQUIRED_FIELDS'
      );
    }

    // 2. Required variant attributes (Dynamic)
    if (requiredVariant.length > 0) {
      const providedIds = product.attributeValues.map((v) => v.attributeId);
      const missing = requiredVariant.filter((a) => !providedIds.includes(a.id));
      if (missing.length > 0) {
        throw new AppError(
          `Product (SKU: ${product.sku}) is missing required attribute(s): ${missing.map((a) => a.name).join(', ')}.`,
          400, 'MISSING_REQUIRED_ATTRIBUTES'
        );
      }
    }

    // 3. All 4 images required
    const uploadedTypes = product.images.map((i) => i.imageType);
    const missingImages = REQUIRED_IMAGES.filter((t) => !uploadedTypes.includes(t));
    if (missingImages.length > 0) {
      throw new AppError(
        `Product (SKU: ${product.sku}) is missing image(s): ${missingImages.join(', ')}.`,
        400, 'MISSING_IMAGES'
      );
    }
  }

  return CatalogModel.update(catalogId, { status: 'PENDING_APPROVAL', rejectionNote: null });
};

/**
 * Discard — move to DISCARDED (not deleted).
 */
const discardCatalog = async (catalogId, sellerId) => {
  const catalog = await assertOwnership(catalogId, sellerId);
  if (!['DRAFT', 'REJECTED'].includes(catalog.status)) {
    throw new AppError('Only DRAFT or REJECTED catalogs can be discarded.', 400, 'INVALID_STATUS');
  }
  return CatalogModel.update(catalogId, { status: 'DISCARDED' });
};

// ─── Brand Documents ──────────────────────────────────────────────────────────

const addDocument = async (catalogId, sellerId, documentUrl, documentType) => {
  await assertOwnership(catalogId, sellerId, { requireDraft: true });
  return CatalogModel.addDocument(catalogId, documentUrl, documentType);
};

const deleteDocument = async (catalogId, sellerId, documentId) => {
  await assertOwnership(catalogId, sellerId, { requireDraft: true });
  const doc = await CatalogModel.findDocumentById(documentId);
  if (!doc) throw new AppError('Document not found.', 404, 'NOT_FOUND');
  if (doc.catalogId !== catalogId) throw new AppError('Document does not belong to this catalog.', 403, 'FORBIDDEN');
  return CatalogModel.deleteDocument(documentId);
};

module.exports = {
  createCatalog,
  listMyCatalogs,
  getCatalog,
  saveCatalog,
  submitCatalog,
  discardCatalog,
  addDocument,
  deleteDocument,
};
