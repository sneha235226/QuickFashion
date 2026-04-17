const prisma = require('../config/database');

const PRODUCT_INCLUDE = {
  attributeValues: {
    include: {
      attribute: { select: { id: true, name: true, type: true, isVariant: true, groupType: true } },
    },
  },
  images: { orderBy: { imageType: 'asc' } },
};

// ─── Product ──────────────────────────────────────────────────────────────────

const findById = (id) =>
  prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });

const findByIdRaw = (id) =>
  prisma.product.findUnique({ where: { id } });

const create = (catalogId, data) =>
  prisma.product.create({
    data:    { catalogId, ...data },
    include: PRODUCT_INCLUDE,
  });

const update = (id, data) =>
  prisma.product.update({
    where:   { id },
    data,
    include: PRODUCT_INCLUDE,
  });

const remove = (id) =>
  prisma.product.delete({ where: { id } });

const deleteByCatalogId = (catalogId) =>
  prisma.product.deleteMany({ where: { catalogId } });

/**
 * SKU uniqueness check across all of a seller's catalogs.
 */
const skuExistsForSeller = async (sku, sellerId, excludeProductId = null) => {
  const product = await prisma.product.findFirst({
    where: {
      sku,
      catalog: { sellerId },
      ...(excludeProductId && { id: { not: excludeProductId } }),
    },
  });
  return Boolean(product);
};

// ─── ProductAttributeValue ────────────────────────────────────────────────────

/**
 * Replace all attribute values for a product atomically.
 */
const upsertAttributeValues = (productId, values) =>
  prisma.$transaction([
    prisma.productAttributeValue.deleteMany({ where: { productId } }),
    ...values.map((v) =>
      prisma.productAttributeValue.create({
        data: { productId, attributeId: v.attributeId, value: String(v.value) },
      })
    ),
  ]);

// ─── ProductImage ─────────────────────────────────────────────────────────────

const upsertImage = (productId, imageType, url) =>
  prisma.productImage.upsert({
    where:  { productId_imageType: { productId, imageType } },
    update: { url },
    create: { productId, imageType, url },
  });

const deleteImage = (productId, imageType) =>
  prisma.productImage.delete({
    where: { productId_imageType: { productId, imageType } },
  });

const findImages = (productId) =>
  prisma.productImage.findMany({ where: { productId } });

module.exports = {
  findById,
  findByIdRaw,
  create,
  update,
  remove,
  deleteByCatalogId,
  skuExistsForSeller,
  upsertAttributeValues,
  upsertImage,
  deleteImage,
  findImages,
};
