const CategoryModel = require('../../models/category');
const AppError = require('../../utils/AppError');
const prisma = require('../../config/database');

// ─── Category ────────────────────────────────────────────────────────────────

/**
 * Root-level categories only. Frontend drills down from here.
 */
const listCategories = () => CategoryModel.findRoots();

const getCategoryById = async (id) => {
  const category = await CategoryModel.findById(id);
  if (!category) throw new AppError('Category not found.', 404, 'NOT_FOUND');
  return category;
};

const createCategory = async ({ name, parentId }) => {
  // Check for duplicate name under same parent
  const existing = await prisma.category.findFirst({
    where: { name, parentId: parentId ?? null }
  });
  if (existing) throw new AppError('Category with this name already exists under this parent.', 400, 'DUPLICATE_NAME');

  return CategoryModel.create({ name, parentId });
};

const listByParent = (parentId) => CategoryModel.findByParentId(parentId);


const updateCategory = async (id, data) => {
  const category = await CategoryModel.findById(id);
  if (!category) throw new AppError('Category not found.', 404, 'NOT_FOUND');
  return CategoryModel.update(id, data);
};

// ─── Attributes ───────────────────────────────────────────────────────────────

/**
 * Flat list of all attributes for a category, with options.
 * Used on the admin attribute management page.
 */
const getAttributesByCategory = async (categoryId) => {
  const category = await CategoryModel.findById(categoryId);
  if (!category) throw new AppError('Category not found.', 404, 'NOT_FOUND');
  return CategoryModel.findAttributesFlatByCategoryId(categoryId);
};

/**
 * Add a new attribute to a leaf category.
 * groupType controls which section of the seller form it appears in.
 * isVariant=true  → appears as a column in the variant table (Group 1 / PRODUCT_SIZE_AND_INVENTORY)
 * isVariant=false → appears as a common catalog field (Group 2 or 3)
 */
const addAttribute = async (categoryId, { name, type, isRequired, isVariant, groupType, options }) => {
  const category = await CategoryModel.findById(categoryId);
  if (!category) throw new AppError('Category not found.', 404, 'NOT_FOUND');
  if (!category.isLeaf) throw new AppError('Attributes can only be added to leaf categories.', 400, 'NOT_LEAF');

  const attribute = await CategoryModel.createAttribute(categoryId, {
    name,
    type,
    isRequired: isRequired ?? false,
    isVariant: isVariant ?? true,
    groupType: groupType ?? 'PRODUCT_SIZE_AND_INVENTORY',
  });

  // Insert all options in a single round-trip (no N+1)
  if (type === 'SELECT' && options && options.length > 0) {
    await CategoryModel.createOptions(attribute.id, options);
  }

  return CategoryModel.findAttributeById(attribute.id);
};

/**
 * Update an existing attribute's name, type, isRequired, isVariant, or groupType.
 * If type changes TO SELECT: options array is required.
 * If type changes FROM SELECT: all existing options are deleted.
 */
const updateAttribute = async (attributeId, { name, type, isRequired, isVariant, groupType, options }) => {
  const attribute = await CategoryModel.findAttributeById(attributeId);
  if (!attribute) throw new AppError('Attribute not found.', 404, 'NOT_FOUND');

  const newType = type ?? attribute.type;

  if (newType === 'SELECT' && attribute.type !== 'SELECT') {
    if (!options || options.length === 0) {
      throw new AppError('Provide at least one option when converting to SELECT.', 400, 'OPTIONS_REQUIRED');
    }
  }

  // Atomically update scalar fields + replace options in one transaction
  await prisma.$transaction(async (tx) => {
    await tx.categoryAttribute.update({
      where: { id: attributeId },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(isRequired !== undefined && { isRequired }),
        ...(isVariant !== undefined && { isVariant }),
        ...(groupType !== undefined && { groupType }),
      },
    });

    // DELETE existing options when type leaves SELECT or when a new options array is provided
    if (
      (attribute.type === 'SELECT' && newType !== 'SELECT') ||
      (newType === 'SELECT' && options && options.length > 0)
    ) {
      await tx.attributeOption.deleteMany({ where: { attributeId } });
    }

    // INSERT replacement options
    if (newType === 'SELECT' && options && options.length > 0) {
      await tx.attributeOption.createMany({
        data: options.map((value) => ({ attributeId, value })),
      });
    }
  });

  return CategoryModel.findAttributeById(attributeId);
};

const deleteAttribute = async (attributeId) => {
  const attribute = await CategoryModel.findAttributeById(attributeId);
  if (!attribute) throw new AppError('Attribute not found.', 404, 'NOT_FOUND');
  return CategoryModel.deleteAttribute(attributeId);
};

module.exports = {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  getAttributesByCategory,
  addAttribute,
  updateAttribute,
  deleteAttribute,
};
