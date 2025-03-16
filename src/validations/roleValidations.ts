import Joi from 'joi';

/**
 * Schema for creating a new role
 */
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

/**
 * Schema for updating an existing role
 */
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
}).min(1); // Require at least one field to update

export {
  createRoleSchema,
  updateRoleSchema
};