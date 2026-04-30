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
        const filters = {
            tab: req.query.tab,
            stockFilter: req.query.stockFilter,
            categoryId: req.query.categoryId,
            status: req.query.status
        };
        const result = await inventoryService.listInventory(req.seller.id, filters);
        
        // Sign URLs
        const { getSignUrl } = require('../../utils/s3');
        for (const product of result.products) {
            if (product.images && product.images.length > 0) {
                for (const img of product.images) {
                    if (img.url) img.url = await getSignUrl(img.url);
                }
            }
        }

        return response.success(res, `${result.products.length} product(s) found in inventory.`, result);
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
