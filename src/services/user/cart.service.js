/**
 * Cart Service — business logic + price calculation
 */
const CartModel = require('../../models/cart');
const AppError = require('../../utils/AppError');

/**
 * Get cart with full price breakdown (base price, GST, totals).
 */
const getCart = async (userId) => {
    const cart = await CartModel.getOrCreateCart(userId);

    let totalBasePrice = 0;
    let totalGst = 0;
    let totalTcs = 0;
    let totalTds = 0;
    let totalMrp = 0;

    const items = cart.items.map((item) => {
        const product = item.product;

        // Only show items from APPROVED catalogs
        const price = parseFloat(product.price);
        const mrp = product.mrp ? parseFloat(product.mrp) : price;
        const gstRate = product.gstRate ? parseFloat(product.gstRate) : 0;
        const quantity = item.quantity;

        const itemBasePrice = price * quantity;
        const itemGst = parseFloat(((itemBasePrice * gstRate) / 100).toFixed(2));
        const itemTcs = parseFloat(((itemBasePrice * 0.5) / 100).toFixed(2));
        const itemTds = parseFloat(((itemBasePrice * 0.1) / 100).toFixed(2));
        const itemTotal = parseFloat((itemBasePrice + itemGst).toFixed(2));
        const itemMrpTotal = mrp * quantity;
        const discount = parseFloat((itemMrpTotal - itemBasePrice).toFixed(2));

        totalBasePrice += itemBasePrice;
        totalGst += itemGst;
        totalTcs += itemTcs;
        totalTds += itemTds;
        totalMrp += itemMrpTotal;

        return {
            id: item.id,
            productId: product.id,
            productName: product.productName,
            image: product.images[0]?.url || null,
            brand: product.catalog?.brandName || null,
            category: product.catalog?.category?.name || null,
            price,
            mrp,
            gstRate,
            quantity,
            itemBasePrice,
            itemGst,
            itemTcs,
            itemTds,
            itemTotal,
            discount,
            inStock: product.stock >= quantity,
            availableStock: product.stock,
        };
    });

    const grandTotal = parseFloat((totalBasePrice + totalGst).toFixed(2));
    const totalDiscount = parseFloat((totalMrp - totalBasePrice).toFixed(2));

    return {
        cartId: cart.id,
        itemCount: items.length,
        items,
        summary: {
            totalMrp: parseFloat(totalMrp.toFixed(2)),
            totalBasePrice: parseFloat(totalBasePrice.toFixed(2)),
            totalDiscount,
            totalGst: parseFloat(totalGst.toFixed(2)),
            totalTcs: parseFloat(totalTcs.toFixed(2)),
            totalTds: parseFloat(totalTds.toFixed(2)),
            grandTotal,
        },
    };
};

/**
 * Add item to cart.
 */
const addItem = async (userId, productId, quantity = 1) => {
    // Validate product exists and is from an approved catalog
    const prisma = require('../../config/database');
    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { catalog: { select: { status: true } } },
    });

    if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');
    if (product.catalog.status !== 'APPROVED') {
        throw new AppError('This product is not available for purchase.', 400, 'NOT_APPROVED');
    }
    if (product.stock < quantity) {
        throw new AppError(`Only ${product.stock} units available in stock.`, 400, 'INSUFFICIENT_STOCK');
    }

    const item = await CartModel.addItem(userId, productId, quantity);
    return item;
};

/**
 * Update item quantity.
 */
const updateItemQuantity = async (userId, itemId, quantity) => {
    const item = await CartModel.findItemById(itemId);
    if (!item) throw new AppError('Cart item not found.', 404, 'NOT_FOUND');
    if (item.cart.userId !== userId) throw new AppError('Access denied.', 403, 'FORBIDDEN');

    if (quantity <= 0) {
        await CartModel.removeItem(itemId);
        return { removed: true };
    }

    // Check stock
    const prisma = require('../../config/database');
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (product.stock < quantity) {
        throw new AppError(`Only ${product.stock} units available in stock.`, 400, 'INSUFFICIENT_STOCK');
    }

    return CartModel.updateItemQuantity(itemId, quantity);
};

/**
 * Remove item from cart.
 */
const removeItem = async (userId, itemId) => {
    const item = await CartModel.findItemById(itemId);
    if (!item) throw new AppError('Cart item not found.', 404, 'NOT_FOUND');
    if (item.cart.userId !== userId) throw new AppError('Access denied.', 403, 'FORBIDDEN');

    await CartModel.removeItem(itemId);
    return { removed: true };
};

module.exports = {
    getCart,
    addItem,
    updateItemQuantity,
    removeItem,
};
