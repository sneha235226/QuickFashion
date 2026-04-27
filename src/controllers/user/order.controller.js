const orderService = require('../../services/user/order.service');
const response = require('../../utils/response');

/**
 * POST /api/user/orders
 * Place an order from the current cart.
 */
const placeOrder = async (req, res, next) => {
    try {
        const order = await orderService.createOrder(req.user.id);
        return response.created(res, 'Order placed successfully.', { order });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/user/orders
 * List user orders.
 */
const getOrders = async (req, res, next) => {
    try {
        const orders = await orderService.getOrders(req.user.id);
        return response.success(res, `${orders.length} order(s) found.`, { orders });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/user/orders/:id
 * Get order details.
 */
const getOrderDetail = async (req, res, next) => {
    try {
        const orderId = parseInt(req.params.id, 10);
        const order = await orderService.getOrderDetail(req.user.id, orderId);
        return response.success(res, 'Order details retrieved.', { order });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    placeOrder,
    getOrders,
    getOrderDetail,
};
