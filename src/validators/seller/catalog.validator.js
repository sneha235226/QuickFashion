const Joi = require('joi');

// Create catalog — only categoryId needed to start a DRAFT
const createCatalogSchema = Joi.object({
  categoryId: Joi.number().integer().positive().required().messages({
    'any.required': 'categoryId is required.',
  }),
});

const attributeValueSchema = Joi.object({
  attributeId: Joi.number().integer().positive().required(),
  value: Joi.alternatives().try(Joi.string().trim().min(1), Joi.number()).required(),
});

const productInputSchema = Joi.object({
  productName: Joi.string().trim().min(2).max(200).optional(),
  price: Joi.number().positive().precision(2).required().messages({
    'any.required': 'price is required for each product.',
    'number.positive': 'price must be positive.',
  }),
  mrp: Joi.number().positive().precision(2).optional(),
  returnPrice: Joi.number().positive().precision(2).optional(),
  stock: Joi.number().integer().min(0).required().messages({
    'any.required': 'stock is required for each product.',
  }),
  hsn: Joi.string().trim().max(20).optional(),
  gstRate: Joi.number().valid(0, 5, 12, 18, 28).optional().messages({
    'any.only': 'GST rate must be one of 0, 5, 12, 18, or 28.',
  }),
  netWeight: Joi.number().positive().precision(3).optional(),
  styleCode: Joi.string().trim().max(100).optional(),
  variantAttributes: Joi.array().items(attributeValueSchema).default([]),
});

// Save catalog (DRAFT) — common attributes + product variants
const saveCatalogSchema = Joi.object({
  brandName: Joi.string().trim().min(1).max(200).optional(),
  commonAttributes: Joi.array().items(attributeValueSchema).default([]),
  products: Joi.array().items(productInputSchema).default([]),
});

const brandDocumentInputSchema = Joi.object({
  documentUrl: Joi.string().trim().uri().required(),
  documentType: Joi.string().valid('TRADEMARK', 'AUTHORIZATION_LETTER', 'INVOICE', 'OTHER').required(),
});

const productImageInputSchema = Joi.object({
  imageType: Joi.string().valid('FRONT', 'BACK', 'SIDE', 'ZOOMED').required(),
  url: Joi.string().trim().uri().required(),
});

const unifiedProductInputSchema = productInputSchema.keys({
  images: Joi.array().items(productImageInputSchema).min(4).required().messages({
    'array.min': 'Each product must have at least 4 images (FRONT, BACK, SIDE, ZOOMED).',
  }),
});

// Final consolidated submission schema (Dictionary based)
const finalSubmissionSchema = Joi.object({
  categoryId: Joi.number().integer().positive().required(),
  productInventory: Joi.object({
    productName: Joi.string().trim().min(2).max(200).required(),
    gstRate: Joi.number().valid(0, 5, 12, 18, 28).required(),
    hsn: Joi.string().trim().required(),
    netWeight: Joi.number().positive().required(),
    styleCode: Joi.string().trim().optional(),
  }).required(),
  productDetails: Joi.object().pattern(Joi.string(), Joi.any()).required(),
  otherAttributes: Joi.object({
    brandName: Joi.string().trim().required(),
  }).pattern(Joi.string(), Joi.any()).required(),
  variants: Joi.array().items(
    Joi.object({
      price: Joi.number().positive().required(),
      mrp: Joi.number().positive().required(),
      inventory: Joi.number().integer().min(0).required(),
    }).pattern(Joi.string(), Joi.any())
  ).min(1).required(),
  images: Joi.array().items(Joi.string().uri()).min(1).required(), // Minimal 1, but usually 4
});

// Unified single-request catalog upload
const unifiedCatalogSchema = Joi.object({
  categoryId: Joi.number().integer().positive().required(),
  brandName: Joi.string().trim().min(1).max(200).optional(),
  commonAttributes: Joi.array().items(attributeValueSchema).default([]),
  products: Joi.array().items(unifiedProductInputSchema).min(1).max(9).required(),
  brandDocuments: Joi.array().items(brandDocumentInputSchema).min(1).required().messages({
    'array.min': 'At least one brand document is required.',
  }),
});

// Reject catalog (Admin) — reason required
const rejectCatalogSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(1000).required().messages({
    'any.required': 'Rejection reason is required.',
    'string.min': 'Rejection reason must be at least 5 characters long.',
  }),
});

module.exports = {
  createCatalogSchema,
  saveCatalogSchema,
  rejectCatalogSchema,
  unifiedCatalogSchema,
  finalSubmissionSchema,
};
