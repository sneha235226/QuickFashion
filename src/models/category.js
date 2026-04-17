const prisma = require('../config/database');

// ─── Category ─────────────────────────────────────────────────────────────────

const findRoots = () =>
  prisma.category.findMany({
    where: { parentId: null },
    orderBy: { id: 'asc' },
  });

/**
 * Returns categories at a given level with a `hasChildren` flag.
 * parentId = null  → root categories
 * parentId = <id> → children of that category
 *
 * Uses Prisma _count to avoid N+1 — single query.
 */
const findByParentId = async (parentId) => {
  return prisma.category.findMany({
    where: { parentId: parentId ? parseInt(parentId, 10) : null },
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
      isLeaf: true,
      parentId: true,
      _count: {
        select: { children: true },
      },
    },
    orderBy: { id: 'asc' },
  });
};

const findById = (id) =>
  prisma.category.findUnique({
    where: { id },
    include: { children: { orderBy: { id: 'asc' } } },
  });

const findBySlug = (slug) =>
  prisma.category.findUnique({ where: { slug } });

const create = async (data) => {
  let level = 1;
  if (data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) throw new Error('Parent category not found');
    if (parent.level >= 4) throw new Error('Cannot create subcategory below level 4');
    level = parent.level + 1;
  }

  // Generate slug from name
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return prisma.category.create({
    data: {
      ...data,
      slug,
      level,
      isLeaf: level === 4,
    },
  });
};


const update = (id, data) =>
  prisma.category.update({ where: { id }, data });

// ─── CategoryAttributeGroup ───────────────────────────────────────────────────

const createGroup = (categoryId, name, sortOrder = 0) =>
  prisma.categoryAttributeGroup.create({
    data: { categoryId, name, sortOrder },
  });

const findGroupById = (id) =>
  prisma.categoryAttributeGroup.findUnique({ where: { id } });

const updateGroup = (id, data) =>
  prisma.categoryAttributeGroup.update({ where: { id }, data });

const deleteGroup = (id) =>
  prisma.categoryAttributeGroup.delete({ where: { id } });

// ─── CategoryAttribute ────────────────────────────────────────────────────────

/**
 * Returns attributes grouped by their group.
 * Ungrouped attributes are placed in a "General" bucket at the end.
 */
const findAttributesByCategoryId = async (categoryId) => {
  const [groups, attributes] = await Promise.all([
    prisma.categoryAttributeGroup.findMany({
      where: { categoryId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.categoryAttribute.findMany({
      where: { categoryId },
      include: { options: true },
      orderBy: { id: 'asc' },
    }),
  ]);

  const result = groups.map((g) => ({
    groupId: g.id,
    groupName: g.name,
    sortOrder: g.sortOrder,
    attributes: attributes.filter((a) => a.groupId === g.id),
  }));

  const ungrouped = attributes.filter((a) => a.groupId === null);
  if (ungrouped.length > 0) {
    result.push({ groupId: null, groupName: 'General', sortOrder: 999, attributes: ungrouped });
  }

  return result;
};

/**
 * Seller-facing: attributes grouped by fixed UI sections (Meesho-style 3 groups).
 *
 * Returns:
 * {
 *   productInventory: [...],   // groupType=PRODUCT_INVENTORY → variant table columns
 *   productDetails:   [...],   // groupType=PRODUCT_DETAILS   → Group 2 (common fields)
 *   otherAttributes:  [...],   // groupType=OTHER_ATTRIBUTES  → Group 3 (common fields)
 * }
 */
const findAttributesGroupedForSeller = async (categoryId) => {
  const attributes = await prisma.categoryAttribute.findMany({
    where: { categoryId },
    include: { options: { orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
  });

  return {
    productInventory: {
      name: 'Product, Size and Inventory',
      staticFields: [
        { label: 'Product Name', name: 'productName', type: 'TEXT', isRequired: true },
        { label: 'GST', name: 'gstRate', type: 'SELECT', isRequired: true, options: [0, 5, 12, 18, 28] },
        { label: 'HSN Code', name: 'hsn', type: 'TEXT', isRequired: true },
        { label: 'Net Weight (grams)', name: 'netWeight', type: 'NUMBER', isRequired: true },
        { label: 'Style Code / Product ID', name: 'styleCode', type: 'TEXT', isRequired: false },
      ],
      dynamicAttributes: attributes.filter((a) => a.groupType === 'PRODUCT_INVENTORY'),
    },
    productDetails: {
      name: 'Product Details',
      staticFields: [],
      dynamicAttributes: attributes.filter((a) => a.groupType === 'PRODUCT_DETAILS'),
    },
    otherAttributes: {
      name: 'Other Attributes',
      staticFields: [
        { label: 'Brand Name', name: 'brandName', type: 'TEXT', isRequired: false },
      ],
      dynamicAttributes: attributes.filter((a) => a.groupType === 'OTHER_ATTRIBUTES'),
    },
  };
};

/**
 * Flat list of all attributes for a category — used internally for validation.
 */
const findAttributesFlatByCategoryId = (categoryId) =>
  prisma.categoryAttribute.findMany({
    where: { categoryId },
    include: { options: true },
    orderBy: { id: 'asc' },
  });

const findAttributeById = (id) =>
  prisma.categoryAttribute.findUnique({
    where: { id },
    include: { options: true },
  });

const createAttribute = (categoryId, data) =>
  prisma.categoryAttribute.create({
    data: { categoryId, ...data },
    include: { options: true },
  });

const updateAttribute = (id, data) =>
  prisma.categoryAttribute.update({
    where: { id },
    data,
    include: { options: true },
  });

const deleteAttribute = (id) =>
  prisma.categoryAttribute.delete({ where: { id } });

// ─── AttributeOption ─────────────────────────────────────────────────────────

const addOption = (attributeId, value) =>
  prisma.attributeOption.create({
    data: { attributeId, value },
  });

/**
 * Batch-insert multiple options for an attribute in a single query.
 */
const createOptions = (attributeId, values) =>
  prisma.attributeOption.createMany({
    data: values.map((value) => ({ attributeId, value })),
    skipDuplicates: true,
  });

module.exports = {
  findRoots,
  findByParentId,
  findById,
  findBySlug,
  create,
  update,
  createGroup,
  findGroupById,
  updateGroup,
  deleteGroup,
  findAttributesByCategoryId,
  findAttributesGroupedForSeller,
  findAttributesFlatByCategoryId,
  findAttributeById,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  addOption,
  createOptions,
};
