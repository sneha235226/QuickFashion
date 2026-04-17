const Joi = require('joi');

const attributeValueSchema = Joi.object({
  attributeId: Joi.number().integer().positive().required().messages({
    'any.required': 'attributeId is required for each attribute value.',
  }),
  value: Joi.alternatives()
    .try(Joi.string().trim().min(1), Joi.number())
    .required()
    .messages({
      'any.required': 'value is required for each attribute value.',
    }),
});

// Used for individual product add/update (granular CRUD, not the /save flow)
const addProductSchema = Joi.object({
  productName: Joi.string().trim().min(2).max(200).optional(),
  price:       Joi.number().positive().precision(2).required().messages({
    'any.required': 'Price is required.',
    'number.positive': 'Price must be positive.',
  }),
  mrp:         Joi.number().positive().precision(2).optional(),
  returnPrice: Joi.number().positive().precision(2).optional(),
  stock:       Joi.number().integer().min(0).required().messages({
    'any.required': 'Stock is required.',
    'number.min':   'Stock cannot be negative.',
  }),
  hsn:         Joi.string().trim().max(20).optional(),
  gstRate:     Joi.number().valid(0, 5, 12, 18, 28).optional().messages({
    'any.only': 'GST rate must be one of 0, 5, 12, 18, or 28.',
  }),
  weight:      Joi.number().positive().precision(3).optional(),
  styleCode:   Joi.string().trim().max(100).optional(),
  variantAttributes: Joi.array().items(attributeValueSchema).optional(),
});

const updateProductSchema = Joi.object({
  productName: Joi.string().trim().min(2).max(200).optional(),
  price:       Joi.number().positive().precision(2).optional(),
  mrp:         Joi.number().positive().precision(2).optional(),
  returnPrice: Joi.number().positive().precision(2).optional(),
  stock:       Joi.number().integer().min(0).optional(),
  hsn:         Joi.string().trim().max(20).optional(),
  gstRate:     Joi.number().valid(0, 5, 12, 18, 28).optional(),
  weight:      Joi.number().positive().precision(3).optional(),
  styleCode:   Joi.string().trim().max(100).optional(),
  variantAttributes: Joi.array().items(attributeValueSchema).optional(),
}).min(1).messages({
  'object.min': 'Provide at least one field to update.',
});

module.exports = { addProductSchema, updateProductSchema };
