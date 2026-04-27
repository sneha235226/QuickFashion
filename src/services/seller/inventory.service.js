const prisma = require('../../config/database');
const AppError = require('../../utils/AppError');

/**
 * List all products for a seller with stock levels.
 */
const listInventory = async (sellerId) => {
    return prisma.product.findMany({
        where: {
            catalog: { sellerId }
        },
        select: {
            id: true,
            productName: true,
            sku: true,
            stock: true,
            price: true,
            styleCode: true,
            catalog: {
                select: {
                    id: true,
                    brandName: true,
                    status: true
                }
            },
            images: {
                where: { imageType: 'FRONT' },
                take: 1
            }
        },
        orderBy: { updatedAt: 'desc' }
    });
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
