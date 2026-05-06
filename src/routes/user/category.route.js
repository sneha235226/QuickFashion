const { Router } = require('express');
const categoryController = require('../../controllers/user/category.controller');

const router = Router();

/**
 * GET /api/user/categories
 * Query: { parentId }
 */
router.get('/', categoryController.list);

/**
 * GET /api/user/categories/tree
 * Full category tree
 */
router.get('/tree', categoryController.getTree);

/**
 * GET /api/user/categories/:id/products
 * Get products for a specific category (including subcategories)
 */
router.get('/:id/products', categoryController.getCategoryProducts);

module.exports = router;
