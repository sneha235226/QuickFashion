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
        // a. Create the Order with full financial snapshot
        const order = await tx.order.create({
            data: {
                userId,
                subTotal: cart.summary.totalBasePrice,
                totalGst: cart.summary.totalGst,
                totalTcs: cart.summary.totalTcs,
                totalTds: cart.summary.totalTds,
                totalDiscount: cart.summary.totalDiscount,
                grandTotal: cart.summary.grandTotal,
                status: 'PLACED',
                items: {
                    create: cart.items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.price,
                        mrp: item.mrp,
                        gstAmount: item.itemGst,
                        tcsAmount: item.itemTcs,
                        tdsAmount: item.itemTds,
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

        // d. Prepare clean response
        return {
            ...order,
            subTotal: Number(order.subTotal),
            totalGst: Number(order.totalGst),
            totalTcs: Number(order.totalTcs),
            totalTds: Number(order.totalTds),
            totalDiscount: Number(order.totalDiscount),
            grandTotal: Number(order.grandTotal),
            items: order.items.map(item => ({
                ...item,
                price: Number(item.price),
                mrp: Number(item.mrp),
                gstAmount: Number(item.gstAmount),
                tcsAmount: Number(item.tcsAmount),
                tdsAmount: Number(item.tdsAmount)
            }))
        };
    }, {
        timeout: 10000,
    });
};

/**
 * Get all orders for a user.
 */
const getOrders = async (userId) => {
    const orders = await prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
            _count: { select: { items: true } },
            items: {
                take: 3, // preview of first few items
                include: {
                    product: {
                        select: {
                            productName: true,
                            images: { take: 1 }
                        }
                    }
                }
            }
        },
    });

    // Convert Decimals to Numbers for consistent API output
    return orders.map(order => ({
        ...order,
        subTotal: Number(order.subTotal),
        totalGst: Number(order.totalGst),
        totalTcs: Number(order.totalTcs),
        totalTds: Number(order.totalTds),
        totalDiscount: Number(order.totalDiscount),
        grandTotal: Number(order.grandTotal),
        items: order.items.map(item => ({
            ...item,
            price: Number(item.price),
            mrp: Number(item.mrp),
            gstAmount: Number(item.gstAmount),
            tcsAmount: Number(item.tcsAmount),
            tdsAmount: Number(item.tdsAmount)
        }))
    }));
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
                            sku: true
                        }
                    }
                }
            }
        },
    });

    if (!order) throw new AppError('Order not found.', 404, 'NOT_FOUND');
    if (order.userId !== userId) throw new AppError('Access denied.', 403, 'FORBIDDEN');

    // Convert Decimals to Numbers
    return {
        ...order,
        subTotal: Number(order.subTotal),
        totalGst: Number(order.totalGst),
        totalTcs: Number(order.totalTcs),
        totalTds: Number(order.totalTds),
        totalDiscount: Number(order.totalDiscount),
        grandTotal: Number(order.grandTotal),
        items: order.items.map(item => ({
            ...item,
            price: Number(item.price),
            mrp: Number(item.mrp),
            gstAmount: Number(item.gstAmount),
            tcsAmount: Number(item.tcsAmount),
            tdsAmount: Number(item.tdsAmount)
        }))
    };
};

module.exports = {
    createOrder,
    getOrders,
    getOrderDetail,
};
