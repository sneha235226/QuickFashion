/**
 * Cart Controller
 */
const cartService = require('../../services/user/cart.service');
const response = require('../../utils/response');
const Joi = require('joi');

const addItemSchema = Joi.object({
    productId: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).default(1),
});

const updateQuantitySchema = Joi.object({
    quantity: Joi.number().integer().min(0).required(),
});

/**
 * GET /api/user/cart
 * Returns cart with full price breakdown.
 */
const getCart = async (req, res, next) => {
    try {
        const cart = await cartService.getCart(req.user.id);
        return response.success(res, 'Cart retrieved.', cart);
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/user/cart/items
 * Body: { productId, quantity? }
 */
const addItem = async (req, res, next) => {
    try {
        const { error, value } = addItemSchema.validate(req.body);
        if (error) return response.validationError(res, error);

        const item = await cartService.addItem(req.user.id, value.productId, value.quantity);
        return response.created(res, 'Item added to cart.', { item });
    } catch (err) {
        next(err);
    }
};

/**
 * PATCH /api/user/cart/items/:itemId
 * Body: { quantity }
 */
const updateItem = async (req, res, next) => {
    try {
        const { error, value } = updateQuantitySchema.validate(req.body);
        if (error) return response.validationError(res, error);

        const itemId = parseInt(req.params.itemId, 10);
        const result = await cartService.updateItemQuantity(req.user.id, itemId, value.quantity);
        return response.success(res, result.removed ? 'Item removed from cart.' : 'Cart item updated.', result);
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/user/cart/items/:itemId
 */
const removeItem = async (req, res, next) => {
    try {
        const itemId = parseInt(req.params.itemId, 10);
        await cartService.removeItem(req.user.id, itemId);
        return response.success(res, 'Item removed from cart.');
    } catch (err) {
        next(err);
    }
};

module.exports = { getCart, addItem, updateItem, removeItem };
