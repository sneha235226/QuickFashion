const Joi = require('joi');

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Category name is required.',
    'string.min': 'Category name must be at least 2 characters.',
  }),
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).max(120).optional().messages({
    'string.pattern.base': 'Slug may only contain lowercase letters, numbers, and hyphens.',
  }),
  parentId: Joi.number().integer().positive().optional(),
  isLeaf: Joi.boolean().optional(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  isLeaf: Joi.boolean().optional(),
}).min(1).messages({
  'object.min': 'Provide at least one field to update.',
});

const addAttributeSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Attribute name is required.',
  }),
  type: Joi.string().valid('TEXT', 'NUMBER', 'SELECT').required().messages({
    'any.only': 'Attribute type must be TEXT, NUMBER, or SELECT.',
    'any.required': 'Attribute type is required.',
  }),
  isRequired: Joi.boolean().default(false),
  isVariant: Joi.boolean().default(true),
  groupType: Joi.string().valid('PRODUCT_INVENTORY', 'PRODUCT_DETAILS', 'OTHER_ATTRIBUTES').default('PRODUCT_INVENTORY').messages({
    'any.only': 'groupType must be PRODUCT_INVENTORY, PRODUCT_DETAILS, or OTHER_ATTRIBUTES.',
  }),
  // Required when type = SELECT; not allowed otherwise
  options: Joi.when('type', {
    is: 'SELECT',
    then: Joi.array().items(Joi.string().trim().min(1).max(100)).min(1).required().messages({
      'any.required': 'options array is required for SELECT attributes.',
      'array.min': 'Provide at least one option for a SELECT attribute.',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown': 'options are only allowed for SELECT attributes.',
    }),
  }),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  addAttributeSchema,
};
