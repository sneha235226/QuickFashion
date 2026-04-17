const { Router }                   = require('express');
const { protect, requireApproved } = require('../../middleware/auth');
const { uploadDocument, uploadBulk, uploadImages } = require('../../middleware/upload');

const catalogCtrl = require('../../controllers/seller/catalog.controller');
const productCtrl = require('../../controllers/seller/product.controller');

const router = Router();

router.use(protect, requireApproved);

// ─── Catalog ──────────────────────────────────────────────────────────────────

router.post('/',                catalogCtrl.create);          // create empty DRAFT
router.get('/',                 catalogCtrl.list);
router.get('/:catalogId',       catalogCtrl.getOne);
router.post('/:catalogId/save', catalogCtrl.save);            // save common attrs + products
router.post('/:catalogId/submit',  catalogCtrl.submit);
router.post('/:catalogId/discard', catalogCtrl.discard);

// ─── Template ─────────────────────────────────────────────────────────────────

router.get('/:catalogId/template', catalogCtrl.downloadTemplate);

// ─── Brand Documents ──────────────────────────────────────────────────────────

router.post(  '/:catalogId/documents',              uploadDocument, catalogCtrl.uploadDocument);
router.delete('/:catalogId/documents/:documentId',  catalogCtrl.deleteDocument);

// ─── Single Product CRUD (still available for granular edits) ─────────────────

router.post(  '/:catalogId/products/bulk',                          uploadBulk,    productCtrl.bulk);
router.post(  '/:catalogId/products',                                              productCtrl.add);
router.get(   '/:catalogId/products/:productId',                                   productCtrl.getOne);
router.patch( '/:catalogId/products/:productId',                                   productCtrl.update);
router.delete('/:catalogId/products/:productId',                                   productCtrl.remove);

// ─── Product Images (S3) ──────────────────────────────────────────────────────
// Fields: FRONT, BACK, SIDE, ZOOMED  (multipart, any subset per call)

router.post(  '/:catalogId/products/:productId/images',             uploadImages,  productCtrl.uploadImages);

module.exports = router;
