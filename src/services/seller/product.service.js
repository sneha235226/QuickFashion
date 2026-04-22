const ProductModel = require('../../models/product');
const CatalogModel = require('../../models/catalog');
const CategoryModel = require('../../models/category');
const AppError = require('../../utils/AppError');
const { generateUniqueSku } = require('../../utils/sku');
const { getPublicUrl } = require('../../utils/s3');

const MAX_PRODUCTS = 9;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const assertCatalogEditable = async (catalogId, sellerId) => {
  const catalog = await CatalogModel.findByIdRaw(catalogId);
  if (!catalog) throw new AppError('Catalog not found.', 404, 'NOT_FOUND');
  if (catalog.sellerId !== sellerId) throw new AppError('Access denied.', 403, 'FORBIDDEN');
  if (catalog.status !== 'DRAFT') {
    throw new AppError('Products can only be modified on DRAFT catalogs.', 400, 'NOT_EDITABLE');
  }
  return catalog;
};

/**
 * Validate variant attribute values (isVariant=true) for a product row.
 */
const resolveVariantAttributes = async (categoryId, inputs = []) => {
  const allAttrs = await CategoryModel.findAttributesFlatByCategoryId(categoryId);
  const variants = allAttrs.filter((a) => a.isVariant);
  const attrMap = new Map(variants.map((a) => [a.id, a]));
  const resolved = [];

  for (const { attributeId, value } of inputs) {
    const attr = attrMap.get(attributeId);
    if (!attr) {
      throw new AppError(`Attribute ID ${attributeId} is not a variant attribute for this category.`, 400, 'INVALID_ATTRIBUTE');
    }
    if (attr.type === 'NUMBER' && isNaN(Number(value))) {
      throw new AppError(`Attribute "${attr.name}" must be a number.`, 400, 'INVALID_ATTRIBUTE_VALUE');
    }
    if (attr.type === 'SELECT') {
      const allowed = attr.options.map((o) => o.value.toLowerCase());
      if (!allowed.includes(String(value).toLowerCase())) {
        throw new AppError(
          `"${value}" is not valid for "${attr.name}". Allowed: ${attr.options.map((o) => o.value).join(', ')}.`,
          400,
          'INVALID_ATTRIBUTE_VALUE'
        );
      }
    }
    resolved.push({ attributeId, value: String(value) });
  }

  return resolved;
};

// ─── Product CRUD ─────────────────────────────────────────────────────────────

const addProduct = async (catalogId, sellerId, data) => {
  const catalog = await assertCatalogEditable(catalogId, sellerId);

  const count = await CatalogModel.countProducts(catalogId);
  if (count >= MAX_PRODUCTS) {
    throw new AppError(`A catalog cannot have more than ${MAX_PRODUCTS} products.`, 400, 'PRODUCT_LIMIT');
  }

  const sku = await generateUniqueSku(
    async (candidate) => !(await ProductModel.skuExistsForSeller(candidate, sellerId))
  );

  const {
    productName, price, mrp, returnPrice,
    stock, hsn, gstRate, netWeight, styleCode,
    variantAttributes = [],
  } = data;

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

  if (variantAttributes.length > 0) {
    const resolved = await resolveVariantAttributes(catalog.categoryId, variantAttributes);
    await ProductModel.upsertAttributeValues(product.id, resolved);
  }

  return ProductModel.findById(product.id);
};

const updateProduct = async (productId, catalogId, sellerId, data) => {
  const catalog = await assertCatalogEditable(catalogId, sellerId);

  const product = await ProductModel.findByIdRaw(productId);
  if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');
  if (product.catalogId !== catalogId) throw new AppError('Product does not belong to this catalog.', 403, 'FORBIDDEN');

  const {
    variantAttributes,
    productName, price, mrp, returnPrice,
    stock, hsn, gstRate, netWeight, styleCode,
  } = data;

  const updateData = {};
  if (productName !== undefined) updateData.productName = productName;
  if (price !== undefined) updateData.price = price;
  if (mrp !== undefined) updateData.mrp = mrp;
  if (returnPrice !== undefined) updateData.returnPrice = returnPrice;
  if (stock !== undefined) updateData.stock = stock;
  if (hsn !== undefined) updateData.hsn = hsn;
  if (gstRate !== undefined) updateData.gstRate = gstRate;
  if (netWeight !== undefined) updateData.netWeight = netWeight;
  if (styleCode !== undefined) updateData.styleCode = styleCode;

  if (Object.keys(updateData).length > 0) {
    await ProductModel.update(productId, updateData);
  }

  if (variantAttributes && variantAttributes.length > 0) {
    const resolved = await resolveVariantAttributes(catalog.categoryId, variantAttributes);
    await ProductModel.upsertAttributeValues(productId, resolved);
  }

  return ProductModel.findById(productId);
};

const deleteProduct = async (productId, catalogId, sellerId) => {
  await assertCatalogEditable(catalogId, sellerId);
  const product = await ProductModel.findByIdRaw(productId);
  if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');
  if (product.catalogId !== catalogId) throw new AppError('Product does not belong to this catalog.', 403, 'FORBIDDEN');
  return ProductModel.remove(productId);
};

const getProduct = async (productId, catalogId, sellerId) => {
  const catalog = await CatalogModel.findByIdRaw(catalogId);
  if (!catalog) throw new AppError('Catalog not found.', 404, 'NOT_FOUND');
  if (catalog.sellerId !== sellerId) throw new AppError('Access denied.', 403, 'FORBIDDEN');

  const product = await ProductModel.findById(productId);
  if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');
  if (product.catalogId !== catalogId) throw new AppError('Product does not belong to this catalog.', 403, 'FORBIDDEN');
  return product;
};

// ─── Product Images ───────────────────────────────────────────────────────────

/**
 * Called after multer-s3 runs. req.files is a map of imageType → [file].
 * Upserts each uploaded image into the ProductImage table.
 */
const uploadImages = async (productId, catalogId, sellerId, files) => {
  const catalog = await assertCatalogEditable(catalogId, sellerId);

  const product = await ProductModel.findByIdRaw(productId);
  if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');
  if (product.catalogId !== catalogId) throw new AppError('Product does not belong to this catalog.', 403, 'FORBIDDEN');

  const VALID_TYPES = ['FRONT', 'BACK', 'SIDE', 'ZOOMED'];
  const saved = [];

  for (const imageType of VALID_TYPES) {
    const uploaded = files[imageType];
    if (!uploaded || uploaded.length === 0) continue;

    const url = getPublicUrl(uploaded[0].key); // Full S3 URL
    await ProductModel.upsertImage(productId, imageType, url);
    saved.push({ imageType, url });
  }

  if (saved.length === 0) {
    throw new AppError('No valid image fields uploaded. Use FRONT, BACK, SIDE, or ZOOMED as field names.', 400, 'NO_IMAGES');
  }

  return ProductModel.findById(productId);
};

module.exports = { addProduct, updateProduct, deleteProduct, getProduct, uploadImages };
