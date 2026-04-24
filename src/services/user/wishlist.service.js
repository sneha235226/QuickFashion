/**
 * Wishlist Service — business logic
 */
const WishlistModel = require('../../models/wishlist');
const AppError = require('../../utils/AppError');

/**
 * Get all wishlist items for a user.
 */
const getWishlist = async (userId) => {
    const items = await WishlistModel.findByUserId(userId);

    return items.map((item) => ({
        id: item.id,
        productId: item.product.id,
        productName: item.product.productName,
        price: parseFloat(item.product.price),
        mrp: item.product.mrp ? parseFloat(item.product.mrp) : null,
        image: item.product.images[0]?.url || null,
        brand: item.product.catalog?.brandName || null,
        category: item.product.catalog?.category?.name || null,
        inStock: item.product.stock > 0,
        addedAt: item.createdAt,
    }));
};

/**
 * Add to wishlist.
 */
const addToWishlist = async (userId, productId) => {
    // Validate product exists
    const prisma = require('../../config/database');
    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { catalog: { select: { status: true } } },
    });

    if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');
    if (product.catalog.status !== 'APPROVED') {
        throw new AppError('This product is not available.', 400, 'NOT_APPROVED');
    }

    return WishlistModel.add(userId, productId);
};

/**
 * Remove from wishlist.
 */
const removeFromWishlist = async (userId, productId) => {
    const isInWishlist = await WishlistModel.isWishlisted(userId, productId);
    if (!isInWishlist) throw new AppError('Product not in your wishlist.', 404, 'NOT_FOUND');

    await WishlistModel.remove(userId, productId);
    return { removed: true };
};

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
};
