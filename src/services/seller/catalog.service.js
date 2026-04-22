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
    return next(new AppError('Please select the deepest category (Level 4) before creating a catalog.', 400, 'NOT_LEAF'));
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

  return CatalogModel.update(catalogId, { status: 'SUBMITTED', rejectionNote: null });
};

/**
 * Discard — move to DISCARDED (not deleted).
 */
const discardCatalog = async (catalogId, sellerId) => {
  const catalog = await assertOwnership(catalogId, sellerId);
  if (!['DRAFT', 'REJECTED'].includes(catalog.status)) {
    throw new AppError('Only DRAFT or REJECTED catalogs can be deleted.', 400, 'INVALID_STATUS');
  }
  return prisma.catalog.delete({ where: { id: catalogId } });
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

/**
- [/] Implement Unified Seller Catalog Upload flow <!-- id: 17 -->
  - [x] Add unified catalog validator <!-- id: 18 -->
  - [x] Implement createUnifiedCatalog service <!-- id: 19 -->
  - [ ] Add unified catalog upload controller/route <!-- id: 20 -->
 */
const createUnifiedCatalog = async (sellerId, payload) => {
  const { categoryId, brandName, commonAttributes = [], products = [], brandDocuments = [] } = payload;

  // 1. Basic category check
  const category = await CategoryModel.findById(categoryId);
  if (!category) throw new AppError('Category not found.', 404, 'NOT_FOUND');
  if (!category.isLeaf) throw new AppError('Catalogs can only be created in leaf categories.', 400, 'NOT_LEAF');

  // 2. Attribute validation logic (similar to submitCatalog)
  const allAttrs = await CategoryModel.findAttributesFlatByCategoryId(categoryId);
  const requiredCommon = allAttrs.filter((a) => a.isRequired && !a.isVariant);
  const requiredVariant = allAttrs.filter((a) => a.isRequired && a.isVariant);

  // Check required common
  const commonIds = commonAttributes.map(a => a.attributeId);
  const missingCommon = requiredCommon.filter(a => !commonIds.includes(a.id));
  if (missingCommon.length > 0) {
    throw new AppError(`Missing required common attribute(s): ${missingCommon.map(a => a.name).join(', ')}`, 400, 'MISSING_ATTRIBUTES');
  }

  // Resolve attributes (validation of types/options)
  const resolvedCommon = await resolveAttributeValues(categoryId, commonAttributes, 'common');

  // Prepare product data
  const preparedProducts = [];
  for (const p of products) {
    const variantIds = (p.variantAttributes || []).map(a => a.attributeId);
    const missingVariant = requiredVariant.filter(a => !variantIds.includes(a.id));
    if (missingVariant.length > 0) {
      throw new AppError(`A product is missing required variant attribute(s): ${missingVariant.map(a => a.name).join(', ')}`, 400, 'MISSING_ATTRIBUTES');
    }

    const resolvedVariant = await resolveAttributeValues(categoryId, p.variantAttributes || [], 'variant');
    const sku = await generateUniqueSku(async (c) => !(await ProductModel.skuExistsForSeller(c, sellerId)));

    preparedProducts.push({ ...p, resolvedVariant, sku });
  }

  // 3. Perform everything in a single transaction
  return prisma.$transaction(async (tx) => {
    // a. Create Catalog
    const catalog = await tx.catalog.create({
      data: {
        sellerId,
        categoryId,
        brandName,
        status: 'SUBMITTED'
      }
    });

    // b. Create Common Attributes
    if (resolvedCommon.length > 0) {
      await tx.catalogAttributeValue.createMany({
        data: resolvedCommon.map(v => ({
          catalogId: catalog.id,
          attributeId: v.attributeId,
          value: v.value
        }))
      });
    }

    // c. Create Brand Documents
    if (brandDocuments.length > 0) {
      await tx.brandDocument.createMany({
        data: brandDocuments.map(d => ({
          catalogId: catalog.id,
          documentUrl: d.documentUrl,
          documentType: d.documentType
        }))
      });
    }

    // d. Create Products and many-to-many
    for (const p of preparedProducts) {
      const product = await tx.product.create({
        data: {
          catalogId: catalog.id,
          productName: p.productName,
          price: p.price,
          mrp: p.mrp,
          returnPrice: p.returnPrice,
          stock: p.stock,
          sku: p.sku,
          hsn: p.hsn,
          gstRate: p.gstRate,
          netWeight: p.netWeight,
          styleCode: p.styleCode
        }
      });

      // Attribute Values
      if (p.resolvedVariant.length > 0) {
        await tx.productAttributeValue.createMany({
          data: p.resolvedVariant.map(v => ({
            productId: product.id,
            attributeId: v.attributeId,
            value: v.value
          }))
        });
      }

      // Images
      if (p.images && p.images.length > 0) {
        await tx.productImage.createMany({
          data: p.images.map(img => ({
            productId: product.id,
            imageType: img.imageType,
            url: img.url
          }))
        });
      }
    }

    return tx.catalog.findUnique({
      where: { id: catalog.id },
      include: {
        products: { include: { attributeValues: true, images: true } },
        commonAttributes: true,
        documents: true
      }
    });
  });
};

/**
 * FINAL CONSOLIDATED SUBMISSION (Single API)
 * Payload format is dictionary-based: { categoryId, productInventory, productDetails, otherAttributes, variants[], images[] }
 */
const submitFinalCatalog = async (sellerId, payload) => {
  const { categoryId, productInventory, productDetails, otherAttributes, variants, images } = payload;

  // 1. Validate category level 4
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { attributes: true }
  });

  if (!category) throw new AppError('Category not found.', 404, 'NOT_FOUND');
  if (!category.isLeaf || category.level !== 4) {
    throw new AppError('Products can only be submitted to Level 4 (Leaf) categories.', 400, 'NOT_LEAF');
  }

  // 2. Build Name -> ID Map for resolving dictionary keys
  const allAttrs = category.attributes;
  const attrNameMap = {};
  allAttrs.forEach(a => {
    attrNameMap[a.name.toLowerCase()] = a;
  });

  // 3. Resolve Common Attributes (productDetails + otherAttributes)
  // We merge them but ignore "brandName" which goes to the Catalog model
  const rawCommon = { ...productDetails, ...otherAttributes };
  delete rawCommon.brandName; // Handled separately

  const resolvedCommon = [];
  Object.entries(rawCommon).forEach(([name, value]) => {
    const attr = attrNameMap[name.toLowerCase()];
    if (attr && !attr.isVariant) {
      resolvedCommon.push({ attributeId: attr.id, value: String(value) });
    }
  });

  // Check required common
  const requiredCommon = allAttrs.filter(a => a.isRequired && !a.isVariant);
  const resolvedCommonIds = resolvedCommon.map(r => r.attributeId);
  const missingCommon = requiredCommon.filter(a => !resolvedCommonIds.includes(a.id));
  if (missingCommon.length > 0) {
    throw new AppError(`Missing required common attribute(s): ${missingCommon.map(a => a.name).join(', ')}`, 400, 'MISSING_ATTRIBUTES');
  }

  // 4. Resolve Products (Variants)
  const requiredVariant = allAttrs.filter(a => a.isRequired && a.isVariant);
  const preparedProducts = [];

  for (const v of variants) {
    const resolvedVariant = [];
    Object.entries(v).forEach(([name, value]) => {
      // Ignore static product fields (price, mrp, inventory)
      if (['price', 'mrp', 'inventory'].includes(name)) return;

      const attr = attrNameMap[name.toLowerCase()];
      if (attr && attr.isVariant) {
        resolvedVariant.push({ attributeId: attr.id, value: String(value) });
      }
    });

    // Check required variants
    const resolvedVariantIds = resolvedVariant.map(r => r.attributeId);
    const missingVariant = requiredVariant.filter(a => !resolvedVariantIds.includes(a.id));
    if (missingVariant.length > 0) {
      throw new AppError(`A variant is missing required attribute(s): ${missingVariant.map(a => a.name).join(', ')}`, 400, 'MISSING_ATTRIBUTES');
    }

    const sku = await generateUniqueSku(async (c) => !(await ProductModel.skuExistsForSeller(c, sellerId)));

    preparedProducts.push({
      price: v.price,
      mrp: v.mrp,
      stock: v.inventory,
      sku,
      resolvedVariant
    });
  }

  // 5. Atomic Transaction
  return prisma.$transaction(async (tx) => {
    // a. Create Catalog
    const catalog = await tx.catalog.create({
      data: {
        sellerId,
        categoryId,
        brandName: otherAttributes.brandName,
        status: 'SUBMITTED'
      }
    });

    // b. Create Catalog Attributes
    if (resolvedCommon.length > 0) {
      await tx.catalogAttributeValue.createMany({
        data: resolvedCommon.map(r => ({
          catalogId: catalog.id,
          attributeId: r.attributeId,
          value: r.value
        }))
      });
    }

    // c. Create Products (Variants)
    for (const p of preparedProducts) {
      const product = await tx.product.create({
        data: {
          catalogId: catalog.id,
          productName: productInventory.productName, // Shared from inventory top-level
          gstRate: productInventory.gstRate,
          hsn: productInventory.hsn,
          netWeight: productInventory.netWeight,
          styleCode: productInventory.styleCode,
          price: p.price,
          mrp: p.mrp,
          stock: p.stock,
          sku: p.sku
        }
      });

      // Product Attributes
      if (p.resolvedVariant.length > 0) {
        await tx.productAttributeValue.createMany({
          data: p.resolvedVariant.map(rv => ({
            productId: product.id,
            attributeId: rv.attributeId,
            value: rv.value
          }))
        });
      }

      // Product Images (Shared 4 images mapping to every variant)
      const IMAGE_TYPES = ['FRONT', 'BACK', 'SIDE', 'ZOOMED'];
      await tx.productImage.createMany({
        data: images.map((url, index) => ({
          productId: product.id,
          imageType: IMAGE_TYPES[index] || 'OTHER', // Default to other if more than 4 images
          url
        }))
      });
    }

    return tx.catalog.findUnique({
      where: { id: catalog.id },
      include: {
        products: { include: { attributeValues: true, images: true } },
        commonAttributes: true
      }
    });
  });
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
  createUnifiedCatalog,
  submitFinalCatalog,
};
