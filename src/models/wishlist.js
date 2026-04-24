/**
 * Wishlist Model — data access for Wishlist
 */
const prisma = require('../config/database');

const WISHLIST_INCLUDE = {
    product: {
        include: {
            images: { orderBy: { imageType: 'asc' }, take: 1 },
            catalog: { select: { id: true, status: true, brandName: true, category: { select: { id: true, name: true } } } },
        },
    },
};

/**
 * Get all wishlist items for a user.
 */
const findByUserId = (userId) =>
    prisma.wishlist.findMany({
        where: { userId },
        include: WISHLIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
    });

/**
 * Add a product to the wishlist (no-op if already exists).
 */
const add = async (userId, productId) => {
    const existing = await prisma.wishlist.findUnique({
        where: { userId_productId: { userId, productId } },
    });
    if (existing) return existing;

    return prisma.wishlist.create({
        data: { userId, productId },
        include: WISHLIST_INCLUDE,
    });
};

/**
 * Remove a product from the wishlist.
 */
const remove = (userId, productId) =>
    prisma.wishlist.delete({
        where: { userId_productId: { userId, productId } },
    });

/**
 * Check if a product is in the user's wishlist.
 */
const isWishlisted = async (userId, productId) => {
    const item = await prisma.wishlist.findUnique({
        where: { userId_productId: { userId, productId } },
    });
    return Boolean(item);
};

module.exports = {
    findByUserId,
    add,
    remove,
    isWishlisted,
};
