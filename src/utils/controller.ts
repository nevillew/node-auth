import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { AuthenticatedRequest, ControllerFunction } from '../types';
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
 * Interface for pagination parameters
 * @interface
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Interface for sort parameters
 * @interface
 */
export interface SortParams {
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

/**
 * Gets pagination parameters from request query.
 * This is a pure function that transforms query parameters
 * into a structured object for database pagination.
 * 
 * @param {any} query - The request query object
 * @returns {PaginationParams} Normalized pagination parameters
 * 
 * @example
 * // For query: ?page=2&limit=10
 * // Returns: { page: 2, limit: 10, offset: 10 }
 * const pagination = getPaginationParams(req.query);
 */
export const getPaginationParams = (query: any): PaginationParams => {
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 20;
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
};

/**
 * Gets sort parameters from request query.
 * This is a pure function that transforms query parameters
 * into a structured object for database sorting.
 * 
 * @param {any} query - The request query object
 * @param {string} defaultSort - Default field to sort by
 * @param {'ASC' | 'DESC'} defaultOrder - Default sort direction
 * @returns {SortParams} Normalized sort parameters
 * 
 * @example
 * // For query: ?sortBy=name&sortOrder=ASC
 * // Returns: { sortBy: 'name', sortOrder: 'ASC' }
 * const sorting = getSortParams(req.query, 'createdAt', 'DESC');
 */
export const getSortParams = (
  query: any,
  defaultSort = 'createdAt',
  defaultOrder: 'ASC' | 'DESC' = 'DESC'
): SortParams => {
  const sortBy = query.sortBy as string || defaultSort;
  const sortOrder = (query.sortOrder as 'ASC' | 'DESC') || defaultOrder;
  
  return { sortBy, sortOrder };
};

/**
 * Builds a database condition for searching across multiple fields.
 * This demonstrates composition by creating complex query conditions
 * from simpler components.
 * 
 * @param {string | undefined} search - The search query
 * @param {string[]} fields - Fields to search in
 * @returns {any} A Sequelize condition object or null
 * 
 * @example
 * // Returns: { [Op.or]: [
 * //   { name: { [Op.iLike]: '%john%' } },
 * //   { email: { [Op.iLike]: '%john%' } }
 * // ]}
 * const searchCondition = buildSearchCondition('john', ['name', 'email']);
 */
export const buildSearchCondition = (
  search: string | undefined,
  fields: string[]
): Record<string, any> | null => {
  if (!search) return null;
  
  // Create a sanitized search term
  const sanitizedSearch = search.trim();
  if (!sanitizedSearch) return null;
  
  // Map each field to a condition in a pure way
  const fieldConditions = fields.map(field => ({
    [field]: { [Op.iLike]: `%${sanitizedSearch}%` }
  }));
  
  return {
    [Op.or]: fieldConditions
  };
};

/**
 * Builds a date range condition for database queries.
 * This is a pure function that transforms date strings into
 * a structured query condition.
 * 
 * @param {string | undefined} startDate - Start date in ISO format
 * @param {string | undefined} endDate - End date in ISO format
 * @param {string} field - Database field to apply condition to
 * @returns {any} A Sequelize condition object or null
 * 
 * @example
 * // Returns: { createdAt: { [Op.gte]: 2023-01-01, [Op.lte]: 2023-12-31 } }
 * const dateCondition = buildDateRangeCondition('2023-01-01', '2023-12-31');
 */
export const buildDateRangeCondition = (
  startDate: string | undefined,
  endDate: string | undefined,
  field = 'createdAt'
): any => {
  if (!startDate && !endDate) return null;
  
  const condition: any = {};
  if (startDate) condition[Op.gte] = new Date(startDate);
  if (endDate) condition[Op.lte] = new Date(endDate);
  
  return { [field]: condition };
};

/**
 * Combines multiple conditions with AND logic.
 * This is a variadic function that takes any number of conditions
 * and combines them into a single condition.
 * 
 * @param {...any[]} conditions - Conditions to combine
 * @returns {Record<string, any>} Combined condition object
 * 
 * @example
 * // Returns: { [Op.and]: [condition1, condition2] }
 * const whereClause = combineConditions(condition1, condition2);
 */
export const combineConditions = (...conditions: any[]): Record<string, any> => {
  const validConditions = conditions.filter(Boolean);
  if (validConditions.length === 0) return {};
  if (validConditions.length === 1) return validConditions[0];
  
  return { [Op.and]: validConditions };
};

/**
 * Formats a paginated response with consistent structure.
 * This is a pure function that transforms raw database results
 * into a standardized paginated response format.
 * 
 * @template T The type of data items
 * @param {T[]} data - The page of data items
 * @param {number} count - Total count of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Formatted pagination response
 * 
 * @example
 * // Returns: { 
 * //   data: [item1, item2], 
 * //   total: 50, 
 * //   page: 1, 
 * //   totalPages: 25 
 * // }
 * const response = formatPaginatedResponse(items, count, page, limit);
 */
export const formatPaginatedResponse = <T>(
  data: T[],
  count: number,
  page: number,
  limit: number
): {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
} => ({
  data,
  total: count,
  page,
  totalPages: Math.ceil(count / limit)
});

/**
 * Handles API errors in a consistent way.
 * This function centralizes error handling logic.
 * 
 * @param {Response} res - Express response object
 * @param {any} error - Error to handle
 * @returns {void}
 */
export const handleApiError = (res: Response, error: any): void => {
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
  successTransform?: (data: T) => any
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
    wrappedHandlers[key as keyof T] = withErrorHandling(handler) as any;
  }
  
  return wrappedHandlers;
};
