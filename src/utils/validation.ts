import validator from 'validator';
import { z } from 'zod';
import { Result, success, failure, ErrorCode } from './errors';
import { ValidationError } from '../types';

/**
 * Interface for email validation options
 */
export interface EmailValidationOptions {
  allowPlusAddressing?: boolean;
  minDomainSegments?: number;
  blocklistedDomains?: string[];
}

/**
 * Validate an email address with various options
 * 
 * @param email Email to validate
 * @param options Validation options
 * @returns Result indicating if email is valid
 */
export const validateEmail = (
  email: string, 
  options: EmailValidationOptions = {}
): Result<string> => {
  try {
    if (!email || typeof email !== 'string') {
      return failure({
        message: 'Email is required',
        statusCode: 400
      });
    }
    
    // Trim whitespace
    const trimmedEmail = email.trim();
    
    // Basic validation
    if (!validator.isEmail(trimmedEmail)) {
      return failure({
        message: 'Invalid email format',
        statusCode: 400
      });
    }
    
    // Check plus addressing if not allowed
    if (options.allowPlusAddressing === false && trimmedEmail.includes('+')) {
      return failure({
        message: 'Plus addressing not allowed in email',
        statusCode: 400
      });
    }
    
    // Check domain segments (e.g., example.com has 2 segments)
    if (options.minDomainSegments) {
      const domainPart = trimmedEmail.split('@')[1];
      const segments = domainPart.split('.');
      
      if (segments.length < options.minDomainSegments) {
        return failure({
          message: `Email domain must have at least ${options.minDomainSegments} segments`,
          statusCode: 400
        });
      }
    }
    
    // Check against blocklisted domains
    if (options.blocklistedDomains && options.blocklistedDomains.length > 0) {
      const domain = trimmedEmail.split('@')[1];
      
      if (options.blocklistedDomains.includes(domain)) {
        return failure({
          message: 'Email domain not allowed',
          statusCode: 400
        });
      }
    }
    
    return success(trimmedEmail);
  } catch (err) {
    return failure({
      message: 'Error validating email',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Validate password strength
 * 
 * @param password Password to validate
 * @param options Validation options
 * @returns Result indicating if password is valid
 */
export const validatePassword = (
  password: string,
  options: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
  } = {}
): Result<string> => {
  try {
    if (!password) {
      return failure({
        message: 'Password is required',
        statusCode: 400
      });
    }
    
    const minLength = options.minLength || 8;
    
    if (password.length < minLength) {
      return failure({
        message: `Password must be at least ${minLength} characters`,
        statusCode: 400
      });
    }
    
    if (options.requireUppercase && !/[A-Z]/.test(password)) {
      return failure({
        message: 'Password must contain at least one uppercase letter',
        statusCode: 400
      });
    }
    
    if (options.requireLowercase && !/[a-z]/.test(password)) {
      return failure({
        message: 'Password must contain at least one lowercase letter',
        statusCode: 400
      });
    }
    
    if (options.requireNumbers && !/\d/.test(password)) {
      return failure({
        message: 'Password must contain at least one number',
        statusCode: 400
      });
    }
    
    if (options.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
      return failure({
        message: 'Password must contain at least one special character',
        statusCode: 400
      });
    }
    
    return success(password);
  } catch (err) {
    return failure({
      message: 'Error validating password',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Sanitize a string input to prevent XSS attacks
 * 
 * @param input Input string to sanitize
 * @returns Sanitized string
 */
export const sanitizeString = (input?: string): Result<string> => {
  try {
    if (input === undefined || input === null) {
      return success('');
    }
    
    if (typeof input !== 'string') {
      return failure({
        message: 'Input must be a string',
        statusCode: 400
      });
    }
    
    return success(validator.escape(input.trim()));
  } catch (err) {
    return failure({
      message: 'Error sanitizing input',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Sanitize an object's string properties
 * 
 * @param obj Object with string properties to sanitize
 * @returns Sanitized object
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): Result<T> => {
  try {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const sanitizeResult = sanitizeString(value);
        if (!sanitizeResult.ok) {
          return sanitizeResult as Result<any>;
        }
        sanitized[key] = sanitizeResult.value;
      } else if (value === null || value === undefined) {
        sanitized[key] = value;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        const sanitizeResult = sanitizeObject<Record<string, any>>(value);
        if (!sanitizeResult.ok) {
          return failure({
            message: `Failed to sanitize nested object at '${key}'`,
            statusCode: 400,
            code: ErrorCode.VALIDATION_ERROR,
            details: sanitizeResult.error
          });
        }
        sanitized[key] = sanitizeResult.value;
      } else {
        sanitized[key] = value;
      }
    }
    
    return success(sanitized as T);
  } catch (err) {
    return failure({
      message: 'Error sanitizing object',
      statusCode: 500,
      code: ErrorCode.VALIDATION_ERROR,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

// ===== Zod Schema Validation Integration =====

/**
 * Validates data against a Zod schema and returns a Result
 * 
 * This is a pure function that takes a schema and data, performs validation,
 * and returns either a success with the parsed data or a failure with
 * structured validation errors.
 * 
 * @template T The inferred output type from the schema
 * @param {z.ZodType<T>} schema - The Zod schema to validate against
 * @param {unknown} data - The data to validate
 * @param {string} [source] - Optional source identifier for the validation
 * @returns {Result<T>} A Result containing either the parsed data or validation errors
 * 
 * @example
 * // Define a schema
 * const userSchema = z.object({
 *   email: z.string().email(),
 *   name: z.string().min(2)
 * });
 * 
 * // Validate data
 * const result = validateWithSchema(userSchema, {
 *   email: 'invalid', 
 *   name: 'Jo'
 * });
 * 
 * // Result will be a failure with validation errors
 */
export const validateWithSchema = <T>(
  schema: z.ZodType<T>,
  data: unknown,
  source?: string
): Result<T> => {
  try {
    // Parse and validate with Zod
    const parsed = schema.parse(data);
    return success(parsed);
  } catch (err) {
    // Handle Zod validation errors
    if (err instanceof z.ZodError) {
      // Transform Zod errors into our application's format
      const errors: ValidationError[] = err.errors.map(error => ({
        path: error.path,
        message: error.message
      }));
      
      // Group errors by field for better UI display
      const fieldErrors: Record<string, string[]> = {};
      errors.forEach(error => {
        const path = error.path.join('.');
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(error.message);
      });
      
      return failure({
        message: 'Validation error',
        statusCode: 400,
        code: ErrorCode.SCHEMA_VALIDATION_ERROR,
        details: {
          errors: fieldErrors
        },
        source
      });
    }
    
    // Handle unexpected errors
    return failure({
      message: 'Validation failed',
      statusCode: 500,
      code: ErrorCode.INTERNAL_ERROR,
      originalError: err instanceof Error ? err : new Error('Unknown error'),
      source
    });
  }
};

/**
 * Creates a reusable validator function from a schema
 * 
 * This is a higher-order function that returns a validator function
 * pre-configured with a schema. This follows the functional programming
 * pattern of partial application.
 * 
 * @template T The inferred output type from the schema
 * @param {z.ZodType<T>} schema - The Zod schema to use for validation
 * @param {string} [source] - Optional source identifier
 * @returns {(data: unknown) => Result<T>} A validator function
 * 
 * @example
 * // Create a validator
 * const validateUser = createValidator(userSchema, 'UserService');
 * 
 * // Use the validator later
 * const result = validateUser(userData);
 */
export const createValidator = <T>(
  schema: z.ZodType<T>,
  source?: string
): (data: unknown) => Result<T> => {
  return (data: unknown) => validateWithSchema(schema, data, source);
};

/**
 * Validates data and transforms it in a single operation
 * 
 * This function demonstrates function composition by combining
 * validation and transformation into a single operation.
 * 
 * @template T The inferred input type from the schema
 * @template U The transformed output type
 * @param {z.ZodType<T>} schema - The Zod schema to validate against
 * @param {unknown} data - The data to validate
 * @param {(validated: T) => U} transform - Function to transform validated data
 * @param {string} [source] - Optional source identifier
 * @returns {Result<U>} A Result containing either the transformed data or validation errors
 * 
 * @example
 * // Validate and transform in one step
 * const result = validateAndTransform(
 *   userSchema,
 *   userData,
 *   user => ({ ...user, createdAt: new Date() })
 * );
 */
export const validateAndTransform = <T, U>(
  schema: z.ZodType<T>,
  data: unknown,
  transform: (validated: T) => U,
  source?: string
): Result<U> => {
  const result = validateWithSchema(schema, data, source);
  
  if (result.ok) {
    try {
      // Apply transformation to validated data
      return success(transform(result.value));
    } catch (err) {
      return failure({
        message: 'Error transforming validated data',
        statusCode: 500,
        code: ErrorCode.INTERNAL_ERROR,
        originalError: err instanceof Error ? err : new Error('Unknown error'),
        source
      });
    }
  }
  
  return result;
};

// Common validation schema patterns
export const commonSchemas = {
  id: z.string().uuid(),
  email: z.string().email(),
  nonEmptyString: z.string().min(1),
  date: z.coerce.date(),
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['ASC', 'DESC']).default('DESC')
  })
};