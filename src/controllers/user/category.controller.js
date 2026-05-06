const CategoryModel = require('../../models/category');
const response = require('../../utils/response');
const AppError = require('../../utils/AppError');
const prisma = require('../../config/database');
const productService = require('../../services/user/product.service');

/**
 * GET /api/user/categories
 * List root categories or subcategories if parentId is provided.
 */
const list = async (req, res, next) => {
    try {
        const parentId = req.query.parentId ? parseInt(req.query.parentId, 10) : null;
        const categories = await CategoryModel.findByParentId(parentId);
        return response.success(res, `${categories.length} category(s) found.`, { categories });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/user/categories/tree
 * Returns a full tree structure of categories.
 */
const getTree = async (req, res, next) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' },
        });

        // Simple recursive tree builder
        const buildTree = (parentId = null) => {
            return categories
                .filter(c => c.parentId === parentId)
                .map(c => ({
                    ...c,
                    children: buildTree(c.id),
                }));
        };

        const tree = buildTree(null);
        return response.success(res, 'Category tree retrieved.', { tree });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/user/categories/:id/products
 */
const getCategoryProducts = async (req, res, next) => {
    try {
        const categoryId = parseInt(req.params.id, 10);
        
        // Merge query params (sortBy, page, etc.) with the categoryId from URL
        const filters = {
            ...req.query,
            categoryId,
        };

        const result = await productService.listProducts(filters);
        return response.success(res, `Products for category ${categoryId} retrieved.`, result);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    list,
    getTree,
    getCategoryProducts,
};
