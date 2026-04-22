const { Router } = require('express');
const { protect, requireApproved } = require('../../middleware/auth');
const { uploadDocument, uploadImages } = require('../../middleware/upload');

const catalogCtrl = require('../../controllers/seller/catalog.controller');
const productCtrl = require('../../controllers/seller/product.controller');

const router = Router();

router.use(protect, requireApproved);

// ─── Catalog ──────────────────────────────────────────────────────────────────

router.get('/', catalogCtrl.list);
router.get('/:catalogId', catalogCtrl.getOne);
router.post('/:catalogId/save', catalogCtrl.save);            // iterative save
router.post('/:catalogId/discard', catalogCtrl.discard);

router.post('/submit', catalogCtrl.submitFinal); // JSON based
router.post('/submit/multipart', uploadImages, catalogCtrl.submitFinalMultipart); // Form-data based (physical images)



// ─── Brand Documents ──────────────────────────────────────────────────────────

router.post('/:catalogId/documents', uploadDocument, catalogCtrl.uploadDocument);
router.delete('/:catalogId/documents/:documentId', catalogCtrl.deleteDocument);

// ─── Single Product CRUD  ─────────────────

router.post('/:catalogId/products', productCtrl.add);
router.get('/:catalogId/products/:productId', productCtrl.getOne);
router.patch('/:catalogId/products/:productId', productCtrl.update);
router.delete('/:catalogId/products/:productId', productCtrl.remove);

// ─── Product Images (S3) ──────────────────────────────────────────────────────
// Fields: FRONT, BACK, SIDE, ZOOMED  (multipart, any subset per call)

router.post('/:catalogId/products/:productId/images', uploadImages, productCtrl.uploadImages);

module.exports = router;
