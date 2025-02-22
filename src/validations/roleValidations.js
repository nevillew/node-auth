const Joi = require('joi');

const createRoleSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters',
      'any.required': 'Name is required'
    }),
  description: Joi.string()
    .max(200)
    .optional(),
  scopes: Joi.array()
    .items(Joi.string().valid('read', 'write', 'delete', 'admin'))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one scope is required',
      'any.required': 'Scopes are required'
    }),
  permissions: Joi.array()
    .items(Joi.string().uuid())
    .optional()
});

const updateRoleSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .optional(),
  description: Joi.string()
    .max(200)
    .optional(),
  scopes: Joi.array()
    .items(Joi.string().valid('read', 'write', 'delete', 'admin'))
    .min(1)
    .optional(),
  permissions: Joi.array()
    .items(Joi.string().uuid())
    .optional()
}).min(1);

module.exports = {
  createRoleSchema,
  updateRoleSchema
};
