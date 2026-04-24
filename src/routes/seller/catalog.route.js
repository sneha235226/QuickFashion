const { Router } = require('express');
const { protect, requireApproved } = require('../../middleware/auth');
const { uploadCatalogFiles } = require('../../middleware/upload');

const catalogCtrl = require('../../controllers/seller/catalog.controller');

const router = Router();

router.use(protect, requireApproved);

// ─── Unified Catalog Flow (3 clean APIs) ──────────────────────────────────────

router.post('/save-draft', uploadCatalogFiles, catalogCtrl.saveDraft);       // Save as DRAFT
router.post('/submit', uploadCatalogFiles, catalogCtrl.submitForReview);     // Submit for admin approval
router.post('/:catalogId/discard', catalogCtrl.discard);                     // Discard catalog

// ─── Catalog Queries ──────────────────────────────────────────────────────────

router.get('/', catalogCtrl.list);                                           // List all catalogs
router.get('/:catalogId', catalogCtrl.getOne);                               // Get full detail

module.exports = router;
