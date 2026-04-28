const Joi = require('joi');

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
  sku: Joi.string().trim().max(100).optional().allow(null, ''),
  sizeDetails: Joi.object().optional(),
  variantAttributes: Joi.array().items(attributeValueSchema).default([]),
});

const unifiedCatalogSchema = Joi.object({
  catalogId: Joi.number().integer().positive().optional(),
  categoryId: Joi.number().integer().positive().required(),
  brandName: Joi.string().trim().min(1).max(200).optional(),
  commonAttributes: Joi.array().items(attributeValueSchema).default([]),
  products: Joi.array().items(productInputSchema).min(1).max(9).required(),
});

// Reject catalog (Admin) — reason required
const rejectCatalogSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(1000).required().messages({
    'any.required': 'Rejection reason is required.',
    'string.min': 'Rejection reason must be at least 5 characters long.',
  }),
});

module.exports = {
  unifiedCatalogSchema,
  rejectCatalogSchema,
};
