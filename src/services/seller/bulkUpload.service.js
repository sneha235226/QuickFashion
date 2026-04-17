const ProductModel    = require('../../models/product');
const CatalogModel    = require('../../models/catalog');
const CategoryModel   = require('../../models/category');
const AppError        = require('../../utils/AppError');
const { generateUniqueSku } = require('../../utils/sku');
const { parseUploadedFile, STATIC_HEADERS } = require('../../utils/templateGenerator');

const MAX_PRODUCTS = 9;

/**
 * Parse and validate a bulk upload file, then insert all products into the catalog.
 *
 * Rules enforced:
 *  - Catalog must be DRAFT and owned by seller
 *  - Existing product count + upload row count must not exceed MAX_PRODUCTS
 *  - Static required columns: productName, price, stock
 *  - Each row is validated (required fields, type checks, SELECT options)
 *  - SKU is always backend-generated (any sku column in file is ignored)
 *
 * Returns { inserted, errors } — errors are per-row with a rowNumber.
 */
const processBulkUpload = async (catalogId, sellerId, fileBuffer) => {
  // 1. Ownership + editability
  const catalog = await CatalogModel.findByIdRaw(catalogId);
  if (!catalog) throw new AppError('Catalog not found.', 404, 'NOT_FOUND');
  if (catalog.sellerId !== sellerId) throw new AppError('Access denied.', 403, 'FORBIDDEN');
  if (catalog.status !== 'DRAFT') {
    throw new AppError('Bulk upload is only allowed on DRAFT catalogs.', 400, 'NOT_EDITABLE');
  }

  // 2. Parse
  let rows;
  try {
    rows = parseUploadedFile(fileBuffer);
  } catch {
    throw new AppError('Could not parse the uploaded file. Ensure it is a valid CSV or Excel file.', 400, 'PARSE_ERROR');
  }

  if (rows.length === 0) {
    throw new AppError('The uploaded file contains no data rows.', 400, 'EMPTY_FILE');
  }

  // 3. Product count guard
  const existing = await CatalogModel.countProducts(catalogId);
  if (existing + rows.length > MAX_PRODUCTS) {
    throw new AppError(
      `This upload would exceed the ${MAX_PRODUCTS}-product limit. Currently ${existing} product(s) in catalog.`,
      400,
      'PRODUCT_LIMIT'
    );
  }

  // 4. Load category attributes (flat list for validation)
  const attributes = await CategoryModel.findAttributesFlatByCategoryId(catalog.categoryId);
  const attrByName  = new Map(attributes.map((a) => [a.name.toLowerCase(), a]));

  // 5. Validate required static headers are present
  const REQUIRED_STATIC = ['price', 'stock'];
  if (rows.length > 0) {
    const fileHeaders = Object.keys(rows[0]).map((h) => h.toLowerCase());
    const missingHeaders = REQUIRED_STATIC.filter((h) => !fileHeaders.includes(h));
    if (missingHeaders.length > 0) {
      throw new AppError(
        `File is missing required column(s): ${missingHeaders.join(', ')}. Use the template provided.`,
        400,
        'MISSING_COLUMNS'
      );
    }
  }

  // 6. Per-row validation + insert
  const errors   = [];
  const inserted = [];

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i];
    const rowNum = i + 2; // +2 because row 1 is header, row 2 is first data row
    const rowErrors = [];

    // Static field validation
    const price = parseFloat(row.price);
    const stock = parseInt(row.stock, 10);

    if (isNaN(price) || price <= 0) rowErrors.push('price must be a positive number.');
    if (isNaN(stock) || stock < 0)  rowErrors.push('stock must be a whole number ≥ 0.');

    // Attribute validation (only variant attributes per row)
    const resolvedAttrs = [];
    for (const [rawKey, rawVal] of Object.entries(row)) {
      const key = rawKey.toLowerCase();
      if (STATIC_HEADERS.includes(key)) continue; // skip static columns
      const attr = attrByName.get(key);
      if (!attr) continue; // unknown column — skip silently

      const val = String(rawVal ?? '').trim();

      if (attr.isRequired && !val) {
        rowErrors.push(`"${attr.name}" is required.`);
        continue;
      }
      if (!val) continue; // optional + empty → skip

      if (attr.type === 'NUMBER' && isNaN(Number(val))) {
        rowErrors.push(`"${attr.name}" must be a number.`);
        continue;
      }
      if (attr.type === 'SELECT') {
        const allowed = attr.options.map((o) => o.value.toLowerCase());
        if (!allowed.includes(val.toLowerCase())) {
          rowErrors.push(`"${val}" is not a valid option for "${attr.name}". Allowed: ${attr.options.map((o) => o.value).join(', ')}.`);
          continue;
        }
      }

      resolvedAttrs.push({ attributeId: attr.id, value: val });
    }

    // Required attribute completeness check
    for (const attr of attributes) {
      if (!attr.isRequired) continue;
      const provided = resolvedAttrs.find((r) => r.attributeId === attr.id);
      if (!provided) rowErrors.push(`Required attribute "${attr.name}" is missing.`);
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, errors: rowErrors });
      continue;
    }

    // Insert
    try {
      const sku = await generateUniqueSku(
        async (candidate) => !(await ProductModel.skuExistsForSeller(candidate, sellerId))
      );

      const productName = String(row.productName ?? row.product_name ?? '').trim() || null;

      const product = await ProductModel.create(catalogId, {
        productName,
        price,
        stock,
        sku,
        mrp:         row.mrp          !== undefined && row.mrp          !== '' ? parseFloat(row.mrp)          : null,
        returnPrice: row.returnPrice   !== undefined && row.returnPrice   !== '' ? parseFloat(row.returnPrice)  : null,
        hsn:         String(row.hsn    ?? '').trim() || null,
        gstRate:     row.gstRate       !== undefined && row.gstRate       !== '' ? parseFloat(row.gstRate)      : null,
        weight:      row.weight        !== undefined && row.weight        !== '' ? parseFloat(row.weight)       : null,
        styleCode:   String(row.styleCode ?? '').trim() || null,
      });

      if (resolvedAttrs.length > 0) {
        await ProductModel.upsertAttributeValues(product.id, resolvedAttrs);
      }

      inserted.push({ row: rowNum, productId: product.id, sku: product.sku });
    } catch (err) {
      errors.push({ row: rowNum, errors: [err.message ?? 'Unexpected error inserting product.'] });
    }
  }

  return { inserted, errors };
};

module.exports = { processBulkUpload };
