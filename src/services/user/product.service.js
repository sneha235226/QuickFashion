const prisma = require('../../config/database');

/**
 * List products available to users.
 * ONLY show products from Catalogs with status = APPROVED.
 */
const listProducts = async (filters = {}) => {
    const {
        categoryId,
        search,
        sortBy = 'latest',
        page = 1,
        limit = 20,
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
        catalog: { status: 'APPROVED' },
    };

    if (categoryId) {
        where.catalog.categoryId = categoryId;
    }

    if (search) {
        where.productName = { contains: search, mode: 'insensitive' };
    }

    // Build order clause
    let orderBy = { createdAt: 'desc' };
    if (sortBy === 'price_low') orderBy = { price: 'asc' };
    if (sortBy === 'price_high') orderBy = { price: 'desc' };

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            orderBy,
            skip,
            take: limit,
            include: {
                images: { where: { imageType: 'FRONT' }, take: 1 }, // Show front image in list
                catalog: { select: { brandName: true, category: { select: { name: true } } } },
            },
        }),
        prisma.product.count({ where }),
    ]);

    return {
        products,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

/**
 * Get product details for a user.
 */
const getProductDetails = async (productId) => {
    const product = await prisma.product.findFirst({
        where: {
            id: productId,
            catalog: { status: 'APPROVED' },
        },
        include: {
            images: true,
            attributeValues: {
                include: { attribute: true },
            },
            catalog: {
                include: {
                    category: true,
                    commonAttributes: { include: { attribute: true } },
                },
            },
        },
    });

    return product;
};

/**
 * List catalogs available to users (Grouped view).
 * ONLY show catalogs with status = APPROVED.
 */
const listCatalogs = async (filters = {}) => {
    const {
        categoryId,
        search,
        page = 1,
        limit = 20,
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
        status: 'APPROVED',
    };

    if (categoryId) {
        where.categoryId = categoryId;
    }

    if (search) {
        where.OR = [
            { brandName: { contains: search, mode: 'insensitive' } },
            { products: { some: { productName: { contains: search, mode: 'insensitive' } } } },
        ];
    }

    const [catalogs, total] = await Promise.all([
        prisma.catalog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                category: { select: { name: true } },
                products: {
                    take: 1, // Get representative product
                    include: {
                        images: { where: { imageType: 'FRONT' }, take: 1 },
                    },
                },
            },
        }),
        prisma.catalog.count({ where }),
    ]);

    return {
        catalogs,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

module.exports = { listProducts, getProductDetails, listCatalogs };
