const productService = require('../../services/user/product.service');
const response = require('../../utils/response');
const AppError = require('../../utils/AppError');
const Joi = require('joi');

const listSchema = Joi.object({
    categoryId: Joi.number().integer().optional(),
    search: Joi.string().trim().optional(),
    sortBy: Joi.string().valid('latest', 'price_low', 'price_high').default('latest'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
});

const list = async (req, res, next) => {
    try {
        const { error, value } = listSchema.validate(req.query);
        if (error) return response.validationError(res, error);

        const result = await productService.listProducts(value);
        return response.success(res, 'Products retrieved successfully.', result);
    } catch (err) {
        next(err);
    }
};

const getOne = async (req, res, next) => {
    try {
        const productId = parseInt(req.params.id, 10);
        const product = await productService.getProductDetails(productId);

        if (!product) {
            throw new AppError('Product not found or not approved.', 404, 'NOT_FOUND');
        }

        return response.success(res, 'Product details retrieved.', { product });
    } catch (err) {
        next(err);
    }
};

module.exports = { list, getOne };
