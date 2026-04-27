const prisma = require('../../config/database');
const cartService = require('./cart.service');
const AppError = require('../../utils/AppError');

/**
 * Create order from user's current cart.
 * Uses Prisma transaction for atomic stock reduction.
 */
const createOrder = async (userId) => {
    // 1. Get cart with full breakdown
    const cart = await cartService.getCart(userId);

    if (!cart.items || cart.items.length === 0) {
        throw new AppError('Your cart is empty.', 400, 'EMPTY_CART');
    }

    // 2. Validate stock for all items BEFORE starting transaction (fail fast)
    for (const item of cart.items) {
        if (!item.inStock) {
            throw new AppError(`Product "${item.productName}" is out of stock.`, 400, 'OUT_OF_STOCK');
        }
    }

    // 3. Execution in Transaction
    return prisma.$transaction(async (tx) => {
        // a. Create the Order
        const order = await tx.order.create({
            data: {
                userId,
                totalAmount: cart.summary.grandTotal,
                status: 'PLACED',
                items: {
                    create: cart.items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.price,
                    })),
                },
            },
            include: {
                items: true,
            },
        });

        // b. Reduce stock for each product
        for (const item of cart.items) {
            await tx.product.update({
                where: { id: item.productId },
                data: {
                    stock: { decrement: item.quantity },
                },
            });
        }

        // c. Clear the cart
        await tx.cartItem.deleteMany({
            where: { cartId: cart.cartId },
        });

        return order;
    }, {
        timeout: 10000, // 10s timeout for safety
    });
};

/**
 * Get all orders for a user.
 */
const getOrders = async (userId) => {
    return prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
            _count: { select: { items: true } },
        },
    });
};

/**
 * Get detailed order view.
 */
const getOrderDetail = async (userId, orderId) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            items: {
                include: {
                    product: {
                        select: {
                            productName: true,
                            images: { take: 1 },
                            styleCode: true,
                        }
                    }
                }
            }
        },
    });

    if (!order) throw new AppError('Order not found.', 404, 'NOT_FOUND');
    if (order.userId !== userId) throw new AppError('Access denied.', 403, 'FORBIDDEN');

    return order;
};

module.exports = {
    createOrder,
    getOrders,
    getOrderDetail,
};
