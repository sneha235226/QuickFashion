const { Router } = require('express');
const productController = require('../../controllers/user/product.controller');

const router = Router();

/**
 * GET /api/products
 * Query: { categoryId, search, sortBy, page, limit }
 */
router.get('/', productController.list);

/**
 * GET /api/products/catalogs
 * Approved catalogs for homepage/listing
 */
router.get('/catalogs', productController.listCatalogs);

/**
 * GET /api/products/:id
 */
router.get('/:id', productController.getOne);

module.exports = router;
