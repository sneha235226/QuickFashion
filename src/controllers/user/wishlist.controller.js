/**
 * Wishlist Controller
 */
const wishlistService = require('../../services/user/wishlist.service');
const response = require('../../utils/response');
const Joi = require('joi');

const addSchema = Joi.object({
    productId: Joi.number().integer().positive().required(),
});

/**
 * GET /api/user/wishlist
 */
const getWishlist = async (req, res, next) => {
    try {
        const items = await wishlistService.getWishlist(req.user.id);
        return response.success(res, `${items.length} item(s) in wishlist.`, { items });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/user/wishlist
 * Body: { productId }
 */
const addToWishlist = async (req, res, next) => {
    try {
        const { error, value } = addSchema.validate(req.body);
        if (error) return response.validationError(res, error);

        const item = await wishlistService.addToWishlist(req.user.id, value.productId);
        return response.created(res, 'Added to wishlist.', { item });
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/user/wishlist/:productId
 */
const removeFromWishlist = async (req, res, next) => {
    try {
        const productId = parseInt(req.params.productId, 10);
        await wishlistService.removeFromWishlist(req.user.id, productId);
        return response.success(res, 'Removed from wishlist.');
    } catch (err) {
        next(err);
    }
};

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
