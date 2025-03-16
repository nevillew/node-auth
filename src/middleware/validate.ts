import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createAppError } from './errorHandler';

type ValidationLocation = 'body' | 'query' | 'params' | 'headers' | 'all';

interface ValidationError {
  field: string;
  message: string;
  type: string;
}

/**
 * Pure function to validate data against a schema
 */
const validateData = <T>(
  schema: Joi.Schema, 
  data: any, 
  options: Joi.ValidationOptions = {}
): { errors?: ValidationError[]; value?: T } => {
  const defaultOptions: Joi.ValidationOptions = {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
    ...options
  };

  const { error, value } = schema.validate(data, defaultOptions);

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type
    }));
    
    return { errors };
  }

  return { value: value as T };
};

/**
 * Middleware factory for validating requests
 */
export const validate = (
  schema: Joi.Schema | Record<string, Joi.Schema>,
  location: ValidationLocation = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Determine what data to validate
    const dataToValidate = location === 'all' 
      ? {
          body: req.body,
          query: req.query,
          params: req.params,
          headers: req.headers
        }
      : req[location as keyof Request];

    // Use our pure validation function
    const schemaToUse = location === 'all' 
      ? Joi.object(schema as Record<string, Joi.Schema>)
      : schema as Joi.Schema;
    
    const result = validateData(schemaToUse, dataToValidate);

    if (result.errors) {
      return next(createAppError('INVALID_INPUT', 400, { errors: result.errors }));
    }

    // Replace validated data
    if (location === 'all' && result.value) {
      if (result.value.body) req.body = result.value.body;
      if (result.value.query) req.query = result.value.query;
      if (result.value.params) req.params = result.value.params;
      // Headers are read-only, so we don't replace them
    } else if (result.value) {
      (req as any)[location] = result.value;
    }

    next();
  };
};

/**
 * Common validation schemas with TypeScript return types
 */
export const commonSchemas = {
  uuid: Joi.string().uuid(),
  email: Joi.string().email(),
  password: Joi.string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string(),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC')
  })
};

/**
 * Type-safe schema creation helper
 */
export const createSchema = <T>(schema: Joi.Schema): Joi.Schema => schema;

/**
 * Helper to validate arbitrary data outside of middleware context
 */
export const validateSchema = <T>(
  schema: Joi.Schema, 
  data: any
): { valid: boolean; errors?: ValidationError[]; value?: T } => {
  const result = validateData<T>(schema, data);
  
  if (result.errors) {
    return { valid: false, errors: result.errors };
  }
  
  return { valid: true, value: result.value };
};