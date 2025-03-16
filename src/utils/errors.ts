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
 * @template T The type that would have been returned in success case
 */
export type ErrorResult<T> = { ok: false; error: AppErrorOptions };

/**
 * Represents a successful result with the returned value
 * @template T The type of the success value
 */
export type SuccessResult<T> = { ok: true; value: T };

/**
 * Union type representing either a success or error result
 * @template T The type of the success value
 */
export type Result<T> = SuccessResult<T> | ErrorResult<T>;

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
 * @template T The type that would have been returned in success case
 * @param {AppErrorOptions} options - Error details
 * @returns {ErrorResult<T>} An error result containing the error details
 * 
 * @example
 * // Returns { ok: false, error: { message: 'Not found', statusCode: 404 } }
 * const result = failure({ message: 'Not found', statusCode: 404, code: ErrorCode.NOT_FOUND });
 */
export const failure = <T>(options: AppErrorOptions): ErrorResult<T> => ({
  ok: false,
  error: options,
});

/**
 * Creates a standard error result with the specified error code
 * 
 * @template T The type that would have been returned in success case
 * @param {keyof typeof ErrorCodes} errorCode - Standard error code from the ErrorCodes constant
 * @param {Record<string, unknown>} [details] - Optional additional error details
 * @returns {ErrorResult<T>} An error result with standardized error information
 * 
 * @example
 * // Returns a standardized not found error result
 * const result = standardError<User>('RESOURCE_NOT_FOUND', { resourceType: 'User', id: '123' });
 */
export const standardError = <T>(
  errorCode: keyof typeof ErrorCodes, 
  details?: Record<string, unknown>,
  source?: string
): ErrorResult<T> => {
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
  
  return failure<T>({
    message: errorInfo.message,
    code: ErrorCode[errorCode as keyof typeof ErrorCode] || ErrorCode.INTERNAL_ERROR,
    statusCode,
    details: details || undefined,
    source,
    isOperational: true
  });
};

/**
 * Maps database errors to appropriate standard error codes
 * 
 * This function implements pattern matching on database error messages
 * to return appropriate typed error codes, improving error handling
 * throughout the application.
 * 
 * @template T The type that would have been returned in success case
 * @param {Error} error - The database error that occurred
 * @param {string} [source] - Optional source identifier
 * @returns {ErrorResult<T>} A standardized error result
 * 
 * @example
 * // Convert Sequelize errors to standard error codes
 * try {
 *   await User.create(data);
 * } catch (err) {
 *   return databaseError<User>(err, 'UserService.create');
 * }
 */
export const databaseError = <T>(error: Error, source?: string): ErrorResult<T> => {
  // Normalize the error message for easier pattern matching
  const errorMessage = error.message.toLowerCase();
  
  // Check for specific database error types using pattern matching
  // This is a pure functional approach to categorizing errors
  
  // Foreign key violations
  if (errorMessage.includes('foreign key constraint') || errorMessage.includes('violates foreign key')) {
    return failure<T>({
      message: 'Foreign key constraint violation',
      statusCode: 400,
      code: ErrorCode.FOREIGN_KEY_VIOLATION,
      details: { originalError: error.message },
      source
    });
  }
  
  // Unique constraint violations
  if (errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key') || errorMessage.includes('already exists')) {
    return failure<T>({
      message: 'Unique constraint violation',
      statusCode: 409,
      code: ErrorCode.UNIQUE_CONSTRAINT_VIOLATION,
      details: { originalError: error.message },
      source
    });
  }
  
  // Check constraint violations
  if (errorMessage.includes('check constraint') || errorMessage.includes('violates check')) {
    return failure<T>({
      message: 'Check constraint violation',
      statusCode: 400,
      code: ErrorCode.CHECK_CONSTRAINT_VIOLATION,
      details: { originalError: error.message },
      source
    });
  }
  
  // Deadlocks
  if (errorMessage.includes('deadlock') || errorMessage.includes('could not serialize')) {
    return failure<T>({
      message: 'Database deadlock detected',
      statusCode: 409,
      code: ErrorCode.DEADLOCK_ERROR,
      details: { originalError: error.message },
      source
    });
  }
  
  // Timeouts
  if (errorMessage.includes('timeout') || errorMessage.includes('statement timeout')) {
    return failure<T>({
      message: 'Database operation timed out',
      statusCode: 503,
      code: ErrorCode.DATABASE_TIMEOUT,
      details: { originalError: error.message },
      source
    });
  }
  
  // Connection errors
  if (errorMessage.includes('connection') || errorMessage.includes('connecting')) {
    return failure<T>({
      message: 'Database connection error',
      statusCode: 503,
      code: ErrorCode.CONNECTION_ERROR,
      details: { originalError: error.message },
      source
    });
  }
  
  // Transaction errors
  if (errorMessage.includes('transaction') || errorMessage.includes('rollback')) {
    return failure<T>({
      message: 'Database transaction error',
      statusCode: 500,
      code: ErrorCode.TRANSACTION_ERROR,
      details: { originalError: error.message },
      source
    });
  }
  
  // Serialization errors
  if (errorMessage.includes('serialization') || errorMessage.includes('serialize')) {
    return failure<T>({
      message: 'Database serialization error',
      statusCode: 409,
      code: ErrorCode.SERIALIZATION_ERROR,
      details: { originalError: error.message },
      source
    });
  }
  
  // Default database error
  return failure<T>({
    message: 'Database query failed',
    statusCode: 500,
    code: ErrorCode.QUERY_ERROR,
    details: { originalError: error.message },
    source
  });
};

/**
 * Maps resource conflicts to appropriate standard error codes
 * 
 * @template T The type that would have been returned in success case
 * @param {string} conflictType - The type of conflict that occurred
 * @param {Record<string, unknown>} [details] - Optional additional conflict details
 * @param {string} [source] - Optional source identifier
 * @returns {ErrorResult<T>} A standardized error result
 * 
 * @example
 * // Return a version conflict error
 * if (resource.version !== requestedVersion) {
 *   return resourceConflictError<User>(
 *     'version', 
 *     { current: resource.version, requested: requestedVersion }
 *   );
 * }
 */
export const resourceConflictError = <T>(
  conflictType: 'exists' | 'version' | 'locked' | 'deleted' | 'inactive' | 'dependency',
  details?: Record<string, unknown>,
  source?: string
): ErrorResult<T> => {
  switch (conflictType) {
    case 'exists':
      return standardError<T>('RESOURCE_EXISTS', details, source);
    case 'version':
      return standardError<T>('RESOURCE_VERSION_CONFLICT', details, source);
    case 'locked':
      return standardError<T>('RESOURCE_LOCKED', details, source);
    case 'deleted':
      return standardError<T>('RESOURCE_DELETED', details, source);
    case 'inactive':
      return standardError<T>('RESOURCE_INACTIVE', details, source);
    case 'dependency':
      return standardError<T>('RESOURCE_DEPENDENCY_ERROR', details, source);
    default:
      return standardError<T>('RESOURCE_CONFLICT', details, source);
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
): U => (result.ok ? onSuccess(result.value) : onError(result.error));

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
export const mapResult = <T, U>(result: Result<T>, fn: (value: T) => U): Result<U> =>
  result.ok ? success(fn(result.value)) : result;

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
export const chainResult = <T, U>(result: Result<T>, fn: (value: T) => Result<U>): Result<U> =>
  result.ok ? fn(result.value) : result;

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
      return databaseError<T>(error, source);
    }
    
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return standardError<T>('TIMEOUT', { originalError: error.message }, source);
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
      return standardError<T>('INVALID_FORMAT', { originalError: error.message }, source);
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