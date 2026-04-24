/**
 * Cart Model — data access for Cart & CartItem
 */
const prisma = require('../config/database');

const CART_INCLUDE = {
    items: {
        include: {
            product: {
                include: {
                    images: { orderBy: { imageType: 'asc' }, take: 1 },
                    catalog: { select: { id: true, status: true, brandName: true, category: { select: { id: true, name: true } } } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    },
};

/**
 * Get or create a cart for a user (one cart per user).
 */
const getOrCreateCart = async (userId) => {
    let cart = await prisma.cart.findUnique({
        where: { userId },
        include: CART_INCLUDE,
    });

    if (!cart) {
        cart = await prisma.cart.create({
            data: { userId },
            include: CART_INCLUDE,
        });
    }

    return cart;
};

/**
 * Add item to cart (upsert — if exists, increment quantity).
 */
const addItem = async (userId, productId, quantity = 1) => {
    const cart = await prisma.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
    });

    return prisma.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        create: { cartId: cart.id, productId, quantity },
        update: { quantity: { increment: quantity } },
        include: {
            product: {
                include: {
                    images: { orderBy: { imageType: 'asc' }, take: 1 },
                },
            },
        },
    });
};

/**
 * Update item quantity. If quantity <= 0, remove the item.
 */
const updateItemQuantity = async (itemId, quantity) => {
    if (quantity <= 0) {
        return prisma.cartItem.delete({ where: { id: itemId } });
    }
    return prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
        include: {
            product: {
                include: {
                    images: { orderBy: { imageType: 'asc' }, take: 1 },
                },
            },
        },
    });
};

/**
 * Remove an item from the cart.
 */
const removeItem = (itemId) =>
    prisma.cartItem.delete({ where: { id: itemId } });

/**
 * Find a cart item by ID.
 */
const findItemById = (itemId) =>
    prisma.cartItem.findUnique({ where: { id: itemId }, include: { cart: true } });

/**
 * Clear all items from a user's cart.
 */
const clearCart = async (userId) => {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) return;
    return prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
};

module.exports = {
    getOrCreateCart,
    addItem,
    updateItemQuantity,
    removeItem,
    findItemById,
    clearCart,
};
