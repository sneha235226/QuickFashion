const inventoryService = require('../../services/seller/inventory.service');
const response = require('../../utils/response');
const Joi = require('joi');

const updateStockSchema = Joi.object({
    stock: Joi.number().integer().min(0).required(),
});

/**
 * GET /api/seller/inventory
 * List all products with current stock.
 */
const getInventory = async (req, res, next) => {
    try {
        const products = await inventoryService.listInventory(req.seller.id);
        return response.success(res, `${products.length} product(s) found in inventory.`, { products });
    } catch (err) {
        next(err);
    }
};

/**
 * PATCH /api/seller/inventory/:productId
 * Update stock for a specific product.
 */
const updateStock = async (req, res, next) => {
    try {
        const { error, value } = updateStockSchema.validate(req.body);
        if (error) return response.validationError(res, error);

        const productId = parseInt(req.params.productId, 10);
        const result = await inventoryService.updateStock(req.seller.id, productId, value.stock);

        return response.success(res, 'Stock updated successfully.', { product: result });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getInventory,
    updateStock,
};
