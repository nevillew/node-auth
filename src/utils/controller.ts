import { Response, NextFunction } from 'express';
import { ParsedQs } from 'qs';
import { AuthenticatedRequest, ControllerFunction, QueryOptions } from '../types';
import { Result } from './errors';
import logger from '../config/logger';

/**
 * @fileoverview
 * This module implements functional patterns for controller operations.
 * It provides pure utility functions for common controller tasks like
 * parameter parsing, data transformation, and error handling.
 * 
 * Core functional programming patterns used:
 * - Pure functions: No side effects in utility functions
 * - Immutability: Functions return new objects rather than modifying inputs
 * - Function composition: Higher-order functions for building controller pipelines
 * - Decorator pattern: Adding behavior to controllers without modifying implementation
 */

/**
 * Interface for pagination options
 * @interface
 */
export interface PaginationOptions {
  page: number;
  perPage: number;
}

/**
 * Safely converts ParsedQs objects to typed parameters
 * This is a utility function to handle query parameters in a type-safe way
 * 
 * @param {ParsedQs} query - Express query object
 * @returns {Record<string, string | string[] | undefined>} Sanitized query parameters
 */
export const sanitizeQueryParams = (query: ParsedQs): Record<string, string | string[] | undefined> => {
  const result: Record<string, string | string[] | undefined> = {};
  
  Object.entries(query).forEach(([key, value]) => {
    if (typeof value === 'string') {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => String(v));
    } else if (value !== null && typeof value === 'object') {
      // Handle nested ParsedQs objects by converting them to strings
      result[key] = String(value);
    }
  });
  
  return result;
};

/**
 * Get pagination parameters from query in a type-safe way
 * 
 * @param {ParsedQs} query - Express query parameters
 * @returns {PaginationOptions} Pagination options
 */
export const getPaginationParams = (query: ParsedQs): PaginationOptions => {
  const sanitized = sanitizeQueryParams(query);
  return {
    page: sanitized.page ? parseInt(sanitized.page as string, 10) : 1,
    perPage: sanitized.perPage ? parseInt(sanitized.perPage as string, 10) : 20
  };
};

/**
 * Get sorting parameters from query in a type-safe way
 * 
 * @param {ParsedQs} query - Express query parameters
 * @param {string} defaultField - Default field to sort by
 * @param {string} defaultOrder - Default sort order
 * @returns {SortOptions} Sorting options
 */
export const getSortParams = (
  query: ParsedQs, 
  defaultField = 'createdAt', 
  defaultOrder: 'ASC' | 'DESC' = 'DESC'
): { sortBy: string; sortOrder: 'ASC' | 'DESC' } => {
  const sanitized = sanitizeQueryParams(query);
  return {
    sortBy: sanitized.sortBy as string || defaultField,
    sortOrder: (sanitized.sortOrder as 'ASC' | 'DESC') || defaultOrder
  };
};


/**
 * Handles API errors in a consistent way.
 * This function centralizes error handling logic.
 * 
 * @param {Response} res - Express response object
 * @param {any} error - Error to handle
 * @returns {void}
 */
export const handleApiError = (res: Response, error: Error & { statusCode?: number; details?: unknown }): void => {
  logger.error('API error:', { error });
  
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  
  res.status(statusCode).json({
    error: message,
    details: process.env.NODE_ENV !== 'production' ? error.details : undefined
  });
};

/**
 * Higher-order function that wraps controller methods with error handling.
 * This demonstrates the decorator pattern from functional programming,
 * adding behavior without modifying the original function.
 * 
 * @param {ControllerFunction} handler - The controller handler to wrap
 * @returns {ControllerFunction} A wrapped handler with error handling
 * 
 * @example
 * const safeHandler = withErrorHandling(myController);
 */
export const withErrorHandling = (
  handler: ControllerFunction
): ControllerFunction => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (error) {
      handleApiError(res, error);
    }
  };
};

/**
 * Handles service result in a controller by sending appropriate response.
 * This function implements the pattern of lifting imperative code (response handling)
 * into a declarative function.
 * 
 * @template T The type of the success value
 * @param {Result<T>} result - The result to handle
 * @param {Response} res - Express response object
 * @param {number} successStatus - HTTP status code for success
 * @param {(data: T) => any} [successTransform] - Optional transform for success data
 * @returns {void}
 * 
 * @example
 * const result = await userService.getUser(id);
 * handleServiceResult(result, res, 200, user => ({ id: user.id, name: user.name }));
 */
export const handleServiceResult = <T>(
  result: Result<T>,
  res: Response,
  successStatus = 200,
  successTransform?: (data: T) => unknown
): void => {
  if (result.ok) {
    const responseData = successTransform ? successTransform(result.value) : result.value;
    res.status(successStatus).json(responseData);
  } else {
    handleApiError(res, result.error);
  }
};

/**
 * Creates a collection of controller methods with error handling.
 * This is a higher-order function that transforms an object of handlers
 * into an object of wrapped handlers.
 * 
 * @template T The type of the handlers object
 * @param {T} handlers - Object containing controller handler functions
 * @returns {T} Object with the same structure but handlers wrapped with error handling
 * 
 * @example
 * export default createController({
 *   getUser: getUserHandler,
 *   createUser: createUserHandler
 * });
 */
export const createController = <T extends Record<string, ControllerFunction>>(
  handlers: T
): T => {
  const wrappedHandlers = {} as T;
  
  for (const [key, handler] of Object.entries(handlers)) {
    wrappedHandlers[key as keyof T] = withErrorHandling(handler) as T[keyof T];
  }
  
  return wrappedHandlers;
};
