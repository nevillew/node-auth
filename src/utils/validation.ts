import validator from 'validator';
import { z } from 'zod';
import { Result, success, failure, ErrorCode, sequenceResults, mapResult } from './errors';
import { ValidationError } from '../types';

/**
 * Interface for email validation options
 */
export interface EmailValidationOptions {
  readonly allowPlusAddressing?: boolean;
  readonly minDomainSegments?: number;
  readonly blocklistedDomains?: readonly string[];
}

/**
 * Interface for password validation options
 */
export interface PasswordValidationOptions {
  readonly minLength?: number;
  readonly requireUppercase?: boolean;
  readonly requireLowercase?: boolean;
  readonly requireNumbers?: boolean;
  readonly requireSpecialChars?: boolean;
}

/**
 * Validate an email address with various options (pure function)
 * 
 * @param email - Email to validate
 * @param options - Validation options
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
        statusCode: 400,
        code: ErrorCode.MISSING_REQUIRED_FIELD
      });
    }
    
    // Trim whitespace
    const trimmedEmail = email.trim();
    
    // Basic validation
    if (!validator.isEmail(trimmedEmail)) {
      return failure({
        message: 'Invalid email format',
        statusCode: 400,
        code: ErrorCode.EMAIL_FORMAT_INVALID
      });
    }
    
    // Check plus addressing if not allowed
    if (options.allowPlusAddressing === false && trimmedEmail.includes('+')) {
      return failure({
        message: 'Plus addressing not allowed in email',
        statusCode: 400,
        code: ErrorCode.INVALID_FORMAT
      });
    }
    
    // Check domain segments (e.g., example.com has 2 segments)
    if (options.minDomainSegments) {
      const domainPart = trimmedEmail.split('@')[1];
      const segments = domainPart.split('.');
      
      if (segments.length < options.minDomainSegments) {
        return failure({
          message: `Email domain must have at least ${options.minDomainSegments} segments`,
          statusCode: 400,
          code: ErrorCode.INVALID_FORMAT
        });
      }
    }
    
    // Check against blocklisted domains
    if (options.blocklistedDomains && options.blocklistedDomains.length > 0) {
      const domain = trimmedEmail.split('@')[1];
      
      if (options.blocklistedDomains.includes(domain)) {
        return failure({
          message: 'Email domain not allowed',
          statusCode: 400,
          code: ErrorCode.INVALID_FORMAT
        });
      }
    }
    
    return success(trimmedEmail);
  } catch (err) {
    return failure({
      message: 'Error validating email',
      statusCode: 500,
      code: ErrorCode.VALIDATION_ERROR,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Validate password strength (pure function)
 * 
 * @param password - Password to validate
 * @param options - Validation options
 * @returns Result indicating if password is valid
 */
export const validatePassword = (
  password: string,
  options: PasswordValidationOptions = {}
): Result<string> => {
  try {
    if (!password) {
      return failure({
        message: 'Password is required',
        statusCode: 400,
        code: ErrorCode.MISSING_REQUIRED_FIELD
      });
    }
    
    const minLength = options.minLength || 8;
    
    if (password.length < minLength) {
      return failure({
        message: `Password must be at least ${minLength} characters`,
        statusCode: 400,
        code: ErrorCode.PASSWORD_POLICY_VIOLATION
      });
    }
    
    if (options.requireUppercase && !/[A-Z]/.test(password)) {
      return failure({
        message: 'Password must contain at least one uppercase letter',
        statusCode: 400,
        code: ErrorCode.PASSWORD_POLICY_VIOLATION
      });
    }
    
    if (options.requireLowercase && !/[a-z]/.test(password)) {
      return failure({
        message: 'Password must contain at least one lowercase letter',
        statusCode: 400,
        code: ErrorCode.PASSWORD_POLICY_VIOLATION
      });
    }
    
    if (options.requireNumbers && !/\d/.test(password)) {
      return failure({
        message: 'Password must contain at least one number',
        statusCode: 400,
        code: ErrorCode.PASSWORD_POLICY_VIOLATION
      });
    }
    
    if (options.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
      return failure({
        message: 'Password must contain at least one special character',
        statusCode: 400,
        code: ErrorCode.PASSWORD_POLICY_VIOLATION
      });
    }
    
    return success(password);
  } catch (err) {
    return failure({
      message: 'Error validating password',
      statusCode: 500,
      code: ErrorCode.VALIDATION_ERROR,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Sanitize a string input to prevent XSS attacks (pure function)
 * 
 * @param input - Input string to sanitize
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
        statusCode: 400,
        code: ErrorCode.TYPE_ERROR
      });
    }
    
    return success(validator.escape(input.trim()));
  } catch (err) {
    return failure({
      message: 'Error sanitizing input',
      statusCode: 500,
      code: ErrorCode.VALIDATION_ERROR,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Sanitize a value based on its type (pure function)
 * 
 * @param value - Value to sanitize
 * @param key - Key path for nested objects
 * @returns Result with sanitized value
 */
export const sanitizeValue = <T>(
  value: T, 
  key: string = 'root'
): Result<T> => {
  // Handle different types
  if (value === null || value === undefined) {
    return success(value);
  }
  
  if (typeof value === 'string') {
    return sanitizeString(value) as Result<any>;
  }
  
  if (typeof value === 'object' && !Array.isArray(value)) {
    return sanitizeObject(value as Record<string, unknown>, key) as Result<any>;
  }
  
  if (Array.isArray(value)) {
    // Map over array and sanitize each element
    const sanitizedArray: Result<unknown>[] = value.map((item, index) => 
      sanitizeValue(item, `${key}[${index}]`)
    );
    
    // Check if any sanitization failed
    const failedResult = sanitizedArray.find(result => !result.ok);
    if (failedResult && !failedResult.ok) {
      return failedResult as Result<any>;
    }
    
    // Extract values from successful results
    const sanitizedValues = sanitizedArray.map(result => 
      result.ok ? result.value : null
    );
    
    return success(sanitizedValues as T);
  }
  
  // For other primitive types, return as is
  return success(value);
};

/**
 * Sanitize an object's properties (pure function)
 * 
 * @param obj - Object with properties to sanitize
 * @param parentKey - Parent key for nested objects
 * @returns Sanitized object
 */
export const sanitizeObject = <T extends Record<string, unknown>>(
  obj: T, 
  parentKey: string = 'root'
): Result<T> => {
  try {
    // Use functional approach with Object.entries and map/reduce
    // First map each entry to a Result of sanitized entry
    const sanitizeEntry = ([key, value]: readonly [string, unknown]): Result<readonly [string, unknown]> => {
      const fullKey = parentKey === 'root' ? key : `${parentKey}.${key}`;
      const sanitizeResult = sanitizeValue(value, fullKey);
      
      return sanitizeResult.ok 
        ? success([key, sanitizeResult.value] as const)
        : failure({
            message: `Failed to sanitize property '${fullKey}'`,
            statusCode: 400,
            code: ErrorCode.OBJECT_VALIDATION_ERROR,
            details: sanitizeResult.error
          });
    };
    
    // Use sequenceResults to transform array of Results to Result of array
    const entriesResultsArray = Object.entries(obj).map(sanitizeEntry);
    const entriesResult = sequenceResults(entriesResultsArray);
    
    // Transform the Result of entries array to Result of object
    return mapResult(entriesResult, entries => 
      Object.fromEntries(entries) as T
    );
  } catch (err) {
    return failure({
      message: 'Error sanitizing object',
      statusCode: 500,
      code: ErrorCode.VALIDATION_ERROR,
      originalError: err instanceof Error ? err : new Error('Unknown error'),
      source: 'sanitizeObject'
    });
  }
};

/**
 * Transforms Zod errors into a structured format (pure function)
 * 
 * @param zodError - The Zod error to transform
 * @returns Structured error object
 */
export const transformZodError = (zodError: z.ZodError): Record<string, string[]> => {
  // Transform Zod errors into our application's format
  const errors: ValidationError[] = zodError.errors.map(error => ({
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
  
  return fieldErrors;
};

/**
 * Validates data against a Zod schema and returns a Result (pure function)
 * 
 * @template T - The inferred output type from the schema
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @param source - Optional source identifier for the validation
 * @returns Result containing either the parsed data or validation errors
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
      const fieldErrors = transformZodError(err);
      
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
 * Creates a reusable validator function from a schema (pure higher-order function)
 * 
 * @template T - The inferred output type from the schema
 * @param schema - The Zod schema to use for validation
 * @param source - Optional source identifier
 * @returns A validator function
 */
export const createValidator = <T>(
  schema: z.ZodType<T>,
  source?: string
): (data: unknown) => Result<T> => {
  return (data: unknown): Result<T> => validateWithSchema(schema, data, source);
};

/**
 * Validates data and transforms it in a single operation (pure function)
 * 
 * @template T - The inferred input type from the schema
 * @template U - The transformed output type
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @param transform - Function to transform validated data
 * @param source - Optional source identifier
 * @returns Result containing either the transformed data or validation errors
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

/**
 * Common validation schema patterns
 */
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
  }),
  // Additional common schemas
  uuid: z.string().uuid(),
  url: z.string().url(),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/),
  boolean: z.boolean(),
  positiveNumber: z.number().positive(),
  nonNegativeNumber: z.number().min(0),
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/)
};
