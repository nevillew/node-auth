import { AppErrorOptions, ErrorCode } from '../types';
import { ErrorCodes } from '../constants/errors';

/**
 * @fileoverview
 * This module implements the Result pattern from functional programming.
 * The Result pattern represents the outcome of operations that might fail,
 * allowing for predictable error handling without exceptions.
 * 
 * Core functional programming patterns used:
 * - Immutability: All functions return new Result objects, never modifying inputs
 * - Type safety: Generic types ensure type consistency across transformations
 * - Function composition: Higher-order functions allow building data pipelines
 * - Railway-oriented programming: Separate tracks for success/failure cases
 */

/**
 * Represents an error result with the error details
 * This type doesn't need a generic parameter since it doesn't carry a success value
 * but we maintain it for consistent typing with Result<T>
 */
export type ErrorResult = { ok: false; error: AppErrorOptions };

/**
 * Represents a successful result with the returned value
 * @template T The type of the success value
 */
export type SuccessResult<T> = { ok: true; value: T };

/**
 * Union type representing either a success or error result
 * @template T The type of the success value
 */
export type Result<T> = SuccessResult<T> | ErrorResult;

/**
 * Creates a success result containing the provided value
 * 
 * @template T The type of the success value
 * @param {T} value - The value to wrap in a success result
 * @returns {SuccessResult<T>} A success result containing the value
 * 
 * @example
 * // Returns { ok: true, value: 42 }
 * const result = success(42);
 */
export const success = <T>(value: T): SuccessResult<T> => ({ ok: true, value });

/**
 * Creates an error result with the provided error options
 * 
 * @param {AppErrorOptions} options - Error details
 * @returns {ErrorResult} An error result containing the error details
 * 
 * @example
 * // Returns { ok: false, error: { message: 'Not found', statusCode: 404 } }
 * const result = failure({ message: 'Not found', statusCode: 404, code: ErrorCode.NOT_FOUND });
 */
export const failure = (options: AppErrorOptions): ErrorResult => ({
  ok: false,
  error: options,
});

/**
 * Creates a standard error result with the specified error code
 * 
 * @param {keyof typeof ErrorCodes} errorCode - Standard error code from the ErrorCodes constant
 * @param {Record<string, unknown>} [details] - Optional additional error details
 * @returns {ErrorResult} An error result with standardized error information
 * 
 * @example
 * // Returns a standardized not found error result
 * const result = standardError('RESOURCE_NOT_FOUND', { resourceType: 'User', id: '123' });
 */
export const standardError = (
  errorCode: keyof typeof ErrorCodes, 
  details?: Record<string, unknown>,
  source?: string
): ErrorResult => {
  const errorInfo = ErrorCodes[errorCode];
  
  // Map error code category to appropriate status code
  let statusCode = 500;
  const codePrefix = String(errorInfo.code).charAt(0);
  
  // Map common error categories to HTTP status codes
  switch (codePrefix) {
    case '1': // Authentication
      statusCode = 401;
      break;
    case '2': // Authorization
      statusCode = 403;
      break;
    case '3': // Resource
      statusCode = errorCode === 'RESOURCE_NOT_FOUND' ? 404 : 409;
      break;
    case '4': // Validation
      statusCode = 400;
      break;
    case '5': // Tenant
      statusCode = errorCode === 'TENANT_NOT_FOUND' ? 404 : 400;
      break;
    case '6': // Rate Limiting
      statusCode = 429;
      break;
    case '7': // Integration
      statusCode = errorCode === 'SERVICE_UNAVAILABLE' ? 503 : 502;
      break;
    case '8': // Database
      statusCode = 500;
      break;
    case '9': // System
      statusCode = 500;
      break;
    default:
      statusCode = 500;
  }
  
  return failure({
    message: errorInfo.message,
    code: ErrorCode[errorCode as keyof typeof ErrorCode] || ErrorCode.INTERNAL_ERROR,
    statusCode,
    details: details || undefined,
    source,
    isOperational: true
  });
};

/**
 * Type for database error patterns
 */
interface DatabaseErrorPattern {
  pattern: RegExp;
  errorCode: ErrorCode;
  message: string;
  statusCode: number;
}

/**
 * Database error patterns for pattern matching (pure data)
 */
const DATABASE_ERROR_PATTERNS: ReadonlyArray<DatabaseErrorPattern> = [
  {
    pattern: /foreign key constraint|violates foreign key/i,
    errorCode: ErrorCode.FOREIGN_KEY_VIOLATION,
    message: 'Foreign key constraint violation',
    statusCode: 400
  },
  {
    pattern: /unique constraint|duplicate key|already exists/i,
    errorCode: ErrorCode.UNIQUE_CONSTRAINT_VIOLATION,
    message: 'Unique constraint violation',
    statusCode: 409
  },
  {
    pattern: /check constraint|violates check/i,
    errorCode: ErrorCode.CHECK_CONSTRAINT_VIOLATION,
    message: 'Check constraint violation',
    statusCode: 400
  },
  {
    pattern: /deadlock|could not serialize/i,
    errorCode: ErrorCode.DEADLOCK_ERROR,
    message: 'Database deadlock detected',
    statusCode: 409
  },
  {
    pattern: /timeout|statement timeout/i,
    errorCode: ErrorCode.DATABASE_TIMEOUT,
    message: 'Database operation timed out',
    statusCode: 503
  },
  {
    pattern: /connection|connecting/i,
    errorCode: ErrorCode.CONNECTION_ERROR,
    message: 'Database connection error',
    statusCode: 503
  },
  {
    pattern: /transaction|rollback/i,
    errorCode: ErrorCode.TRANSACTION_ERROR,
    message: 'Database transaction error',
    statusCode: 500
  },
  {
    pattern: /serialization|serialize/i,
    errorCode: ErrorCode.SERIALIZATION_ERROR,
    message: 'Database serialization error',
    statusCode: 409
  }
];

/**
 * Maps database errors to appropriate standard error codes
 * 
 * This function implements pattern matching on database error messages
 * to return appropriate typed error codes, improving error handling
 * throughout the application.
 * 
 * @param {Error} error - The database error that occurred
 * @param {string} [source] - Optional source identifier
 * @returns {ErrorResult} A standardized error result
 * 
 * @example
 * // Convert Sequelize errors to standard error codes
 * try {
 *   await User.create(data);
 * } catch (err) {
 *   return databaseError(err, 'UserService.create');
 * }
 */
export const databaseError = (error: Error, source?: string): ErrorResult => {
  const errorMessage = error.message;
  
  // Find matching error pattern using functional pattern matching
  const matchedPattern = DATABASE_ERROR_PATTERNS.find(pattern => 
    pattern.pattern.test(errorMessage)
  );
  
  if (matchedPattern) {
    return failure({
      message: matchedPattern.message,
      statusCode: matchedPattern.statusCode,
      code: matchedPattern.errorCode,
      details: { originalError: errorMessage },
      source
    });
  }
  
  // Default database error
  return failure({
    message: 'Database query failed',
    statusCode: 500,
    code: ErrorCode.QUERY_ERROR,
    details: { originalError: errorMessage },
    source
  });
};

/**
 * Maps resource conflicts to appropriate standard error codes
 * 
 * @param {string} conflictType - The type of conflict that occurred
 * @param {Record<string, unknown>} [details] - Optional additional conflict details
 * @param {string} [source] - Optional source identifier
 * @returns {ErrorResult} A standardized error result
 * 
 * @example
 * // Return a version conflict error
 * if (resource.version !== requestedVersion) {
 *   return resourceConflictError(
 *     'version', 
 *     { current: resource.version, requested: requestedVersion }
 *   );
 * }
 */
export const resourceConflictError = (
  conflictType: 'exists' | 'version' | 'locked' | 'deleted' | 'inactive' | 'dependency',
  details?: Record<string, unknown>,
  source?: string
): ErrorResult => {
  switch (conflictType) {
    case 'exists':
      return standardError('RESOURCE_EXISTS', details, source);
    case 'version':
      return standardError('RESOURCE_VERSION_CONFLICT', details, source);
    case 'locked':
      return standardError('RESOURCE_LOCKED', details, source);
    case 'deleted':
      return standardError('RESOURCE_DELETED', details, source);
    case 'inactive':
      return standardError('RESOURCE_INACTIVE', details, source);
    case 'dependency':
      return standardError('RESOURCE_DEPENDENCY_ERROR', details, source);
    default:
      return standardError('RESOURCE_CONFLICT', details, source);
  }
};

/**
 * Handles a result by applying different functions for success and error cases.
 * This is a pattern known as "pattern matching" or "catamorphism" in functional programming.
 * 
 * @template T The type of the success value in the result
 * @template U The return type of both handlers
 * @param {Result<T>} result - The result to handle
 * @param {(value: T) => U} onSuccess - Function to apply if result is success
 * @param {(error: AppErrorOptions) => U} onError - Function to apply if result is error
 * @returns {U} The output of either onSuccess or onError
 * 
 * @example
 * // Returns "Value is 42"
 * const result = success(42);
 * const output = handleResult(
 *   result,
 *   value => `Value is ${value}`,
 *   error => `Error: ${error.message}`
 * );
 */
export const handleResult = <T, U>(
  result: Result<T>,
  onSuccess: (value: T) => U,
  onError: (error: AppErrorOptions) => U,
): U => {
  if (result.ok) {
    return onSuccess(result.value);
  } else {
    // Type assertion to access the error property
    const errorResult = result as ErrorResult;
    return onError(errorResult.error);
  }
};

/**
 * Transforms the success value of a result using the provided function.
 * This is a "functor" pattern from functional programming - a structure
 * that can be mapped over while preserving its shape.
 * 
 * Error results are passed through unchanged.
 * 
 * @template T The type of the input success value
 * @template U The type of the output success value
 * @param {Result<T>} result - The result to transform
 * @param {(value: T) => U} fn - Function to apply to success value
 * @returns {Result<U>} A new result with transformed success value or unchanged error
 * 
 * @example
 * // Returns { ok: true, value: 84 }
 * const result = success(42);
 * const doubled = mapResult(result, x => x * 2);
 */
export const mapResult = <T, U>(result: Result<T>, fn: (value: T) => U): Result<U> => {
  if (result.ok) {
    return success(fn(result.value));
  } else {
    // Need to type assert here to maintain compatibility
    return result as unknown as Result<U>;
  }
};

/**
 * Transforms an array of Results into a Result of array
 * 
 * This utility either returns a success containing all the successful values,
 * or the first failure encountered.
 * 
 * @template T The type of successful values
 * @param {Result<T>[]} results - Array of Result objects
 * @returns {Result<T[]>} Result containing array of values or first error
 * 
 * @example
 * // Process multiple items and collect results
 * const itemResults = await Promise.all(
 *   items.map(item => processItem(item))
 * );
 * 
 * // Convert array of Results to Result of array
 * const result = sequenceResults(itemResults);
 */
export const sequenceResults = <T>(results: Result<T>[]): Result<T[]> => {
  // Use functional approach with find and map
  // Find the first failure, if any
  const firstFailure = results.find(result => !result.ok);
  
  // Return early if there's a failure
  if (firstFailure && !firstFailure.ok) {
    // Type assertion to maintain compatibility
    return firstFailure as unknown as Result<T[]>;
  }
  
  // Use type assertion to safely extract values
  // This is safe because we've already checked that all results are successful
  const values = results.map(result => (result as SuccessResult<T>).value);
  
  return success(values);
};

/**
 * Chains multiple result-producing operations together, short-circuiting on first error.
 * This implements the "monadic bind" or "flatMap" operation from functional programming,
 * allowing composition of operations that might fail.
 * 
 * @template T The type of the input success value
 * @template U The type of the output success value
 * @param {Result<T>} result - The initial result 
 * @param {(value: T) => Result<U>} fn - Function that takes success value and returns new result
 * @returns {Result<U>} The result of applying fn to the success value, or the original error
 * 
 * @example
 * // Function that might fail
 * const divide = (n: number, d: number): Result<number> =>
 *   d === 0
 *     ? standardError('INVALID_INPUT', { reason: 'Division by zero' })
 *     : success(n / d);
 * 
 * // Chaining operations
 * const result = success(10);
 * const final = chainResult(result, val => divide(val, 2));
 * // final: { ok: true, value: 5 }
 */
export const chainResult = <T, U>(result: Result<T>, fn: (value: T) => Result<U>): Result<U> => {
  if (result.ok) {
    return fn(result.value);
  } else {
    // Type assertion to maintain compatibility
    return result as unknown as Result<U>;
  }
};

/**
 * Converts a promise to a Result, capturing any thrown errors.
 * This bridges the gap between Promise-based error handling (exceptions)
 * and functional Result-based error handling.
 * 
 * @template T The type of the success value
 * @param {Promise<T>} promise - The promise to convert
 * @param {string} [source] - Optional source identifier for error context
 * @returns {Promise<Result<T>>} A promise that resolves to a Result
 * 
 * @example
 * // Converts an API call that might throw an exception into a Result
 * const userResult = await fromPromise(api.getUser(userId), 'UserService.getUser');
 * 
 * // Now we can handle the error functionally
 * if (userResult.ok) {
 *   // Use userResult.value
 * } else {
 *   // Handle userResult.error
 * }
 */
export const fromPromise = async <T>(
  promise: Promise<T>, 
  source?: string
): Promise<Result<T>> => {
  try {
    const value = await promise;
    return success(value);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    
    // Check for specific error types to provide better error codes
    if (error.name === 'SequelizeError' || error.name === 'SequelizeDatabaseError') {
      return databaseError(error, source);
    }
    
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return standardError('TIMEOUT', { originalError: error.message }, source);
    }
    
    return failure({
      message: error.message,
      statusCode: 500,
      code: ErrorCode.INTERNAL_ERROR,
      originalError: error,
      source
    });
  }
};

/**
 * Wraps a potentially throwing function in a Result.
 * This is a synchronous version of fromPromise, using the Either pattern
 * from functional programming to represent operations that might fail.
 * 
 * @template T The return type of the function
 * @param {() => T} fn - Function that might throw
 * @param {string} [source] - Optional source identifier for error context
 * @returns {Result<T>} A Result containing either the return value or the error
 * 
 * @example
 * // Parsing JSON could throw
 * const parseResult = tryCatch(() => JSON.parse(inputString), 'parseUserJSON');
 * 
 * // Safe access to the result
 * if (parseResult.ok) {
 *   // Use parseResult.value
 * } else {
 *   // Handle parseResult.error
 * }
 */
export const tryCatch = <T>(fn: () => T, source?: string): Result<T> => {
  try {
    return success(fn());
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    
    // Check for common error patterns
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('parse') || errorMessage.includes('json') || errorMessage.includes('syntax')) {
      return standardError('INVALID_FORMAT', { originalError: error.message }, source);
    }
    
    return failure({
      message: error.message,
      statusCode: 500,
      code: ErrorCode.INTERNAL_ERROR,
      originalError: error,
      source
    });
  }
};
