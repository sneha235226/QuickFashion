const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { s3, BUCKET } = require('../utils/s3');

// ─── Document upload (brand docs) ─────────────────────────────────────────────

const documentStorage = multerS3({
  s3,
  bucket: BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (_req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `documents/${unique}${ext}`);
  },
});


const documentFilter = (_req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError('Only PDF and image files are allowed for documents.', 400, 'INVALID_FILE_TYPE'));
  }
};

const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: documentFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('document');



/**
 * Wraps multer middleware to propagate errors into Express's next().
 * Multer v2 with Express v5 still benefits from this wrapper.
 */
const wrapMulter = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (err) return next(err);
    next();
  });
};

// ─── Product image upload (S3) ────────────────────────────────────────────────
// Accepts up to 4 images: front, back, side, zoomed (field names match ImageType)

const imageFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPG, PNG, or WEBP images are allowed.', 400, 'INVALID_FILE_TYPE'));
  }
};

const imageUpload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const unique = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `products/${unique}${ext}`);
    },
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per image
}).fields([
  { name: 'FRONT', maxCount: 1 },
  { name: 'BACK', maxCount: 1 },
  { name: 'SIDE', maxCount: 1 },
  { name: 'ZOOMED', maxCount: 1 },
]);

// ─── GST Document upload (S3) ─────────────────────────────────────────────────

const gstUpload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const unique = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `onboarding/gst/${unique}${ext}`);
    },
  }),
  fileFilter: documentFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('gstDocument');


// ─── Catalog unified upload (images + brand doc in one call) ──────────────────

const catalogFilesUpload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const unique = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase();
      const folder = file.fieldname === 'document' ? 'documents' : 'products';
      cb(null, `${folder}/${unique}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'document') {
      return documentFilter(_req, file, cb);
    }
    return imageFilter(_req, file, cb);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: 'FRONT', maxCount: 1 },
  { name: 'BACK', maxCount: 1 },
  { name: 'SIDE', maxCount: 1 },
  { name: 'ZOOMED', maxCount: 1 },
  { name: 'document', maxCount: 1 },
]);

module.exports = {
  uploadDocument: wrapMulter(uploadDocument),
  uploadImages: wrapMulter(imageUpload),
  uploadGst: wrapMulter(gstUpload),
  uploadCatalogFiles: wrapMulter(catalogFilesUpload),
};
