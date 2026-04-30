const prisma = require('../../config/database');
const AppError = require('../../utils/AppError');

/**
 * List all products for a seller with stock levels.
 */
const listInventory = async (sellerId, filters = {}) => {
    const { tab = 'active', stockFilter = 'all', categoryId, status } = filters;
    const where = { catalog: { sellerId, status: { not: 'DISCARDED' } } };

    // 1. Tab Filters based on catalog status
    switch (tab.toLowerCase()) {
        case 'active':
            where.catalog.status = 'APPROVED';
            break;
        case 'activation_pending':
        case 'pending':
            where.catalog.status = 'SUBMITTED';
            break;
        case 'blocked':
            where.catalog.status = { in: ['REJECTED', 'BLOCKED'] };
            break;
        case 'paused':
            where.catalog.status = 'PAUSED';
            break;
        case 'draft':
            where.catalog.status = 'DRAFT';
            break;
        case 'all':
        default:
            if (status && status.toLowerCase() !== 'all') {
                let s = status.toUpperCase();
                if (s === 'PENDING') s = 'SUBMITTED';
                if (s === 'SUSPENDED') s = 'BLOCKED';
                where.catalog.status = s;
            }
            break;
    }

    // 2. Category Filter
    if (categoryId) {
        where.catalog.categoryId = parseInt(categoryId, 10);
    }

    // 3. Stock Filter
    if (stockFilter && stockFilter.toLowerCase() !== 'all') {
        if (stockFilter.toLowerCase() === 'out_of_stock') {
            where.stock = 0;
        } else if (stockFilter.toLowerCase() === 'low_stock') {
            where.stock = { gt: 0, lte: 5 };
        }
    }

    const [products, activeCount, pendingCount, blockedCount, pausedCount] = await prisma.$transaction([
        prisma.product.findMany({
            where,
            select: {
                id: true,
                productName: true,
                sku: true,
                stock: true,
                price: true,
                mrp: true,
                styleCode: true,
                catalog: {
                    select: {
                        id: true,
                        brandName: true,
                        status: true,
                        categoryId: true,
                        category: { select: { name: true } }
                    }
                },
                attributeValues: {
                    include: { attribute: { select: { name: true } } }
                },
                images: {
                    where: { imageType: 'FRONT' },
                    take: 1
                }
            },
            orderBy: { updatedAt: 'desc' }
        }),
        prisma.product.count({ where: { catalog: { sellerId, status: 'APPROVED' } } }),
        prisma.product.count({ where: { catalog: { sellerId, status: 'SUBMITTED' } } }),
        prisma.product.count({ where: { catalog: { sellerId, status: { in: ['REJECTED', 'BLOCKED'] } } } }),
        prisma.product.count({ where: { catalog: { sellerId, status: 'PAUSED' } } })
    ]);

    return { products, counts: { active: activeCount, pending: pendingCount, blocked: blockedCount, paused: pausedCount } };
};

/**
 * Update stock for a specific product.
 */
const updateStock = async (sellerId, productId, newStock) => {
    // 1. Ensure product belongs to the seller
    const product = await prisma.product.findFirst({
        where: {
            id: productId,
            catalog: { sellerId }
        }
    });

    if (!product) {
        throw new AppError('Product not found or access denied.', 404, 'NOT_FOUND');
    }

    // 2. Update stock
    return prisma.product.update({
        where: { id: productId },
        data: { stock: newStock },
        select: {
            id: true,
            productName: true,
            stock: true,
            updatedAt: true
        }
    });
};

module.exports = {
    listInventory,
    updateStock
};
