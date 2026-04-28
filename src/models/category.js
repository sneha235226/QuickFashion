const prisma = require('../config/database');
const AppError = require('../utils/AppError');

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
  let parentSlug = '';
  const parentId = data.parentId ? parseInt(data.parentId, 10) : null;

  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) throw new Error('Parent category not found');
    if (parent.level >= 4) {
      throw new AppError('Maximum category level (4) reached. Cannot create subcategory below level 4.', 400, 'MAX_LEVEL_REACHED');
    }
    level = parent.level + 1;
    parentSlug = parent.slug;
  }

  // Generate hierarchical slug if not provided
  const baseSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const slug = data.slug || (parentSlug ? `${parentSlug}-${baseSlug}` : baseSlug);

  const createData = {
    name: data.name,
    slug,
    level,
    isLeaf: level === 4, // only the deepest level (4) is a leaf by default
  };

  if (parentId) {
    createData.parent = { connect: { id: parentId } };
  }

  const newCategory = await prisma.category.create({ data: createData });

  // When a new child is added, the parent is no longer a leaf
  if (parentId) {
    await prisma.category.update({
      where: { id: parentId },
      data: { isLeaf: false },
    });
  }

  return newCategory;
};


const update = async (id, data) => {
  const current = await prisma.category.findUnique({ where: { id } });
  if (!current) throw new Error('Category not found');

  const updateData = { ...data };
  let slugChanged = false;

  // Handle parentId change (moving category)
  if (data.parentId !== undefined && data.parentId !== current.parentId) {
    const parentId = data.parentId ? parseInt(data.parentId, 10) : null;
    let level = 1;
    let parentSlug = '';

    if (parentId) {
      if (parentId === id) throw new Error('Category cannot be its own parent');
      const parent = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parent) throw new Error('Parent category not found');
      if (parent.level >= 4) throw new Error('Maximum category level (4) reached');
      level = parent.level + 1;
      parentSlug = parent.slug;
    }

    updateData.level = level;
    updateData.isLeaf = level === 4;
    updateData.parentId = parentId;

    // Recalculate slug based on new parent
    const baseSlug = (data.name || current.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    updateData.slug = parentSlug ? `${parentSlug}-${baseSlug}` : baseSlug;
    slugChanged = true;
  }
  // Handle name change (but parentId remains same)
  else if (data.name && data.name !== current.name) {
    let parentSlug = '';
    if (current.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: current.parentId } });
      parentSlug = parent.slug;
    }
    const baseSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    updateData.slug = parentSlug ? `${parentSlug}-${baseSlug}` : baseSlug;
    slugChanged = true;
  }

  const updated = await prisma.category.update({
    where: { id },
    data: updateData
  });

  // If slug changed, we MUST update all children's slugs recursively
  if (slugChanged) {
    await updateChildrenSlugs(id, updated.slug);
  }

  return updated;
};

/**
 * Recursively updates slugs for all descendant categories.
 */
const updateChildrenSlugs = async (parentId, parentSlug) => {
  const children = await prisma.category.findMany({ where: { parentId } });

  for (const child of children) {
    const baseSlug = child.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newSlug = `${parentSlug}-${baseSlug}`;

    await prisma.category.update({
      where: { id: child.id },
      data: { slug: newSlug }
    });

    // Recursive call for grandchildren
    await updateChildrenSlugs(child.id, newSlug);
  }
};

const remove = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: { children: true, catalogs: true }
      }
    }
  });

  if (!category) throw new AppError('Category not found.', 404, 'NOT_FOUND');

  if (category._count.children > 0) {
    throw new AppError('Cannot delete category with sub-categories.', 400, 'HAS_CHILDREN');
  }

  if (category._count.catalogs > 0) {
    throw new AppError('Cannot delete category with associated products (catalogs).', 400, 'HAS_PRODUCTS');
  }

  await prisma.category.delete({ where: { id } });

  // If this was the last child, restore parent to leaf status
  if (category.parentId) {
    const siblingCount = await prisma.category.count({ where: { parentId: category.parentId } });
    if (siblingCount === 0) {
      await prisma.category.update({
        where: { id: category.parentId },
        data: { isLeaf: true },
      });
    }
  }
};

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
    include: { 
      options: { orderBy: { id: 'asc' } },
      sizeTableColumns: {
        orderBy: { sortOrder: 'asc' },
        include: { options: { orderBy: { id: 'asc' } } },
      },
    },
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
    include: { 
      options: true,
      sizeTableColumns: {
        orderBy: { sortOrder: 'asc' },
        include: { options: { orderBy: { id: 'asc' } } },
      },
    },
    orderBy: { id: 'asc' },
  });

const findAttributeById = (id) =>
  prisma.categoryAttribute.findUnique({
    where: { id },
    include: { 
      options: true,
      sizeTableColumns: {
        orderBy: { sortOrder: 'asc' },
        include: { options: { orderBy: { id: 'asc' } } },
      },
    },
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

// ─── SizeTableColumn ─────────────────────────────────────────────────────────

const findSizeColumnsByAttributeId = (attributeId) =>
  prisma.sizeTableColumn.findMany({
    where: { attributeId },
    include: { options: { orderBy: { id: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  });

const findSizeColumnById = (id) =>
  prisma.sizeTableColumn.findUnique({
    where: { id },
    include: { options: { orderBy: { id: 'asc' } } },
  });

const createSizeColumn = (attributeId, data) =>
  prisma.sizeTableColumn.create({
    data: { attributeId, ...data },
    include: { options: true },
  });

const createSizeColumnOptions = (columnId, values) =>
  prisma.sizeTableColumnOption.createMany({
    data: values.map((value) => ({ columnId, value })),
    skipDuplicates: true,
  });

const deleteSizeColumnOptions = (columnId) =>
  prisma.sizeTableColumnOption.deleteMany({ where: { columnId } });

const updateSizeColumn = (id, data) =>
  prisma.sizeTableColumn.update({
    where: { id },
    data,
    include: { options: true },
  });

const deleteSizeColumn = (id) =>
  prisma.sizeTableColumn.delete({ where: { id } });

module.exports = {
  findRoots,
  findByParentId,
  findById,
  findBySlug,
  create,
  update,
  remove,
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
  // Size table columns
  findSizeColumnsByAttributeId,
  findSizeColumnById,
  createSizeColumn,
  createSizeColumnOptions,
  deleteSizeColumnOptions,
  updateSizeColumn,
  deleteSizeColumn,
};
