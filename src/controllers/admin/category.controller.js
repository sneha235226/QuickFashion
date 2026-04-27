const categoryService = require('../../services/admin/category.service');
const response = require('../../utils/response');
const {
  createCategorySchema,
  updateCategorySchema,
  addAttributeSchema,
} = require('../../validators/admin/category.validator');

// ─── Category ─────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/categories?parentId=
 * Returns categories for a given parent, or roots if parentId is null.
 * Includes hasChildren flag.
 */
const list = async (req, res, next) => {
  try {
    const parentId = req.query.parentId || null;
    const categories = await categoryService.listByParent(parentId);

    // Process to add hasChildren flag
    const processed = categories.map(c => ({
      ...c,
      hasChildren: c._count.children > 0,
      _count: undefined // hide Prisma count object
    }));

    return response.success(res, `${processed.length} category/categories found.`, { categories: processed });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/categories/:id
 */
const getOne = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryById(parseInt(req.params.id, 10));
    return response.success(res, 'Category retrieved.', { category });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/categories
 * Body: { name, slug, parentId?, isLeaf? }
 */
const create = async (req, res, next) => {
  try {
    const { error, value } = createCategorySchema.validate(req.body, { abortEarly: false });
    if (error) return response.validationError(res, error);

    const category = await categoryService.createCategory(value);
    return response.created(res, 'Category created.', { category });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/categories/:id
 * Body: { name?, isLeaf? }
 */
const update = async (req, res, next) => {
  try {
    const { error, value } = updateCategorySchema.validate(req.body, { abortEarly: false });
    if (error) return response.validationError(res, error);

    const category = await categoryService.updateCategory(parseInt(req.params.id, 10), value);
    return response.success(res, 'Category updated.', { category });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/categories/:id
 */
const remove = async (req, res, next) => {
  try {
    await categoryService.deleteCategory(parseInt(req.params.id, 10));
    return response.success(res, 'Category deleted successfully.');
  } catch (err) {
    next(err);
  }
};

// ─── Attributes ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/categories/:id/attributes
 * Returns flat list of all attributes with their groupType, isVariant, options.
 */
const listAttributes = async (req, res, next) => {
  try {
    const attributes = await categoryService.getAttributesByCategory(parseInt(req.params.id, 10));
    return response.success(res, `${attributes.length} attribute(s) found.`, { attributes });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/categories/:id/attributes
 * Body: { name, type, isRequired?, isVariant?, groupType?, options? }
 *
 * groupType controls which section of the seller form it appears in:
 *   PRODUCT_INVENTORY  → variant table column (e.g. Size, Color)
 *   PRODUCT_DETAILS    → Group 2 common fields (e.g. Fabric)
 *   OTHER_ATTRIBUTES   → Group 3 common fields (e.g. Care Instructions)
 *
 * isVariant=true  → per-product variant row
 * isVariant=false → catalog-level common field
 */
const addAttribute = async (req, res, next) => {
  try {
    const { error, value } = addAttributeSchema.validate(req.body, { abortEarly: false });
    if (error) return response.validationError(res, error);

    const attribute = await categoryService.addAttribute(parseInt(req.params.id, 10), value);
    return response.created(res, 'Attribute added.', { attribute });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/categories/:id/attributes/:attributeId
 * Body: { name?, type?, isRequired?, isVariant?, groupType?, options? }
 */
const updateAttribute = async (req, res, next) => {
  try {
    const attribute = await categoryService.updateAttribute(
      parseInt(req.params.attributeId, 10),
      req.body
    );
    return response.success(res, 'Attribute updated.', { attribute });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/categories/:id/attributes/:attributeId
 */
const deleteAttribute = async (req, res, next) => {
  try {
    await categoryService.deleteAttribute(parseInt(req.params.attributeId, 10));
    return response.success(res, 'Attribute deleted.');
  } catch (err) {
    next(err);
  }
};

// ─── Size Table Columns ───────────────────────────────────────────────────────

/**
 * POST /api/admin/categories/:id/attributes/:attributeId/size-columns
 */
const addSizeColumn = async (req, res, next) => {
  try {
    const column = await categoryService.addSizeColumn(
      parseInt(req.params.attributeId, 10),
      req.body
    );
    return response.created(res, 'Size column added.', { column });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/categories/:id/attributes/:attributeId/size-columns/:columnId
 */
const updateSizeColumn = async (req, res, next) => {
  try {
    const column = await categoryService.updateSizeColumn(
      parseInt(req.params.columnId, 10),
      req.body
    );
    return response.success(res, 'Size column updated.', { column });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/categories/:id/attributes/:attributeId/size-columns/:columnId
 */
const deleteSizeColumn = async (req, res, next) => {
  try {
    await categoryService.deleteSizeColumn(parseInt(req.params.columnId, 10));
    return response.success(res, 'Size column deleted.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list, getOne, create, update, remove,
  listAttributes, addAttribute, updateAttribute, deleteAttribute,
  addSizeColumn, updateSizeColumn, deleteSizeColumn,
};
