const { Router } = require('express');
const { adminProtect } = require('../../middleware/auth');
const categoryCtrl = require('../../controllers/admin/category.controller');

const router = Router();

router.use(adminProtect);

// ─── Category CRUD ────────────────────────────────────────────────────────────

router.get('/', categoryCtrl.list);    // root categories
router.post('/', categoryCtrl.create);  // create (set parentId for nested)
router.get('/:id', categoryCtrl.getOne);  // detail + children
router.patch('/:id', categoryCtrl.update); // update 
router.delete('/:id', categoryCtrl.remove); // delete

// ─── Attributes ───────────────────────────────────────────────────────────────

router.get('/:id/attributes', categoryCtrl.listAttributes);
router.post('/:id/attributes', categoryCtrl.addAttribute);
router.patch('/:id/attributes/:attributeId', categoryCtrl.updateAttribute);
router.delete('/:id/attributes/:attributeId', categoryCtrl.deleteAttribute);

// ─── Size Table Columns (for MULTI_SELECT attributes) ─────────────────────────

router.post('/:id/attributes/:attributeId/size-columns', categoryCtrl.addSizeColumn);
router.patch('/:id/attributes/:attributeId/size-columns/:columnId', categoryCtrl.updateSizeColumn);
router.delete('/:id/attributes/:attributeId/size-columns/:columnId', categoryCtrl.deleteSizeColumn);

module.exports = router;
