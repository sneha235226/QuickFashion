const Joi = require('joi');

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Category name is required.',
    'string.min': 'Category name must be at least 2 characters.',
  }),
  slug: Joi.string().trim().lowercase().optional(),
  parentId: Joi.number().integer().positive().optional().allow(null),
  isLeaf: Joi.boolean().optional(),
  commissionRate: Joi.number().min(0).max(100).optional(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  parentId: Joi.number().integer().positive().optional().allow(null),
  isLeaf: Joi.boolean().optional(),
  commissionRate: Joi.number().min(0).max(100).optional(),
}).min(1).messages({
  'object.min': 'Provide at least one field to update.',
});

const addAttributeSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Attribute name is required.',
  }),
  type: Joi.string().valid('TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT').required().messages({
    'any.only': 'Attribute type must be TEXT, NUMBER, SELECT, or MULTI_SELECT.',
    'any.required': 'Attribute type is required.',
  }),
  isRequired: Joi.boolean().default(false),
  isVariant: Joi.boolean().default(true),
  groupType: Joi.string().valid('PRODUCT_INVENTORY', 'PRODUCT_DETAILS', 'OTHER_ATTRIBUTES').default('PRODUCT_INVENTORY').messages({
    'any.only': 'groupType must be PRODUCT_INVENTORY, PRODUCT_DETAILS, or OTHER_ATTRIBUTES.',
  }),
  // Required when type = SELECT or MULTI_SELECT; not allowed otherwise
  options: Joi.when('type', {
    is: Joi.valid('SELECT', 'MULTI_SELECT'),
    then: Joi.array().items(Joi.string().trim().min(1).max(100)).min(1).required().messages({
      'any.required': 'options array is required for SELECT/MULTI_SELECT attributes.',
      'array.min': 'Provide at least one option for a SELECT/MULTI_SELECT attribute.',
    }),
    otherwise: Joi.array().items(Joi.string().trim().min(1).max(100)).optional().default([]),
  }),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  addAttributeSchema,
};
