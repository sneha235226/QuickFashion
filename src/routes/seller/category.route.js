const { Router } = require('express');
const { protect, requireApproved } = require('../../middleware/auth');
const CategoryModel = require('../../models/category');
const AppError = require('../../utils/AppError');
const response = require('../../utils/response');

const router = Router();

router.use(protect, requireApproved);

router.get('/', async (req, res, next) => {
  try {
    const parentId = req.query.parentId ? parseInt(req.query.parentId, 10) : null;
    if (parentId !== null) {
      const parent = await CategoryModel.findById(parentId);
      if (!parent) return next(new AppError('Parent category not found.', 404, 'NOT_FOUND'));
    }

    const categories = await CategoryModel.findByParentId(parentId);
    return response.success(res, `${categories.length} category/categories found.`, { categories });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/attributes', async (req, res, next) => {
  try {
    const category = await CategoryModel.findById(parseInt(req.params.id, 10));
    if (!category) return next(new AppError('Category not found.', 404, 'NOT_FOUND'));

    if (!category.isLeaf) {
      return next(new AppError(
        'Please select the deepest category before viewing attributes.',
        400,
        'NOT_LEAF'
      ));
    }

    const groups = await CategoryModel.findAttributesGroupedForSeller(category.id);
    return response.success(res, 'Attributes retrieved.', { category, groups });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
