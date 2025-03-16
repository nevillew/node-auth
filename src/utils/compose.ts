/**
 * @fileoverview
 * This module provides utilities for functional composition of service operations.
 * 
 * Core functional programming patterns used:
 * - Function composition
 * - Pipelining
 * - Either/Result pattern integration
 * - Pure functional transformation
 * 
 * These utilities enable clean, declarative composition of business logic
 * in a way that maintains good error handling and readability.
 */

import { Result, success, failure, ErrorCode } from './errors';

/**
 * Composes multiple service functions into a single function
 * 
 * This is a pure utility that combines functions in a sequence, where
 * the output of each function is passed as input to the next function.
 * 
 * @template T - Type of input to the first function
 * @template U - Type of output from the last function
 * @param {Array<Function>} fns - Functions to compose (rightmost is executed first)
 * @returns {Function} Composed function that executes the sequence
 * 
 * @example
 * // Compose multiple pure functions
 * const processUser = compose(
 *   addTimestamps,
 *   sanitizeUserData,
 *   validateUser
 * );
 * 
 * // Use the composed function
 * const result = processUser(userData);
 */
export const compose = <T, U>(...fns: Array<(arg: any) => any>): (arg: T) => U => {
  return (arg: T) => fns.reduceRight((result, fn) => fn(result), arg);
};

/**
 * Composes async functions that return Result objects
 * 
 * This utility combines multiple async functions that follow the Result pattern,
 * short-circuiting on the first error result.
 * 
 * @template T - Type of input to the first function
 * @template U - Type of final success result
 * @param {Array<Function>} fns - Async functions that return Result objects
 * @returns {Function} Composed async function
 * 
 * @example
 * // Compose multiple service functions that return Result
 * const createUserWorkflow = composeAsync(
 *   user => auditService.logUserCreation(user),
 *   user => notificationService.sendWelcomeEmail(user),
 *   user => userService.createUser(user)
 * );
 * 
 * // Use the composed function
 * const result = await createUserWorkflow(userData);
 */
export const composeAsync = <T, U>(
  ...fns: ((arg: any) => Promise<Result<any>>)[]
) => {
  return async (arg: T): Promise<Result<U>> => {
    let result: Result<any> = success(arg);
    
    for (const fn of fns.reverse()) {
      if (!result.ok) {
        return result;
      }
      
      result = await fn(result.value);
    }
    
    return result as Result<U>;
  };
};

/**
 * Transforms a Result value if successful
 * 
 * This is a pure function that applies a transformation to a successful Result value.
 * 
 * @template T - Type of input value
 * @template U - Type of output value
 * @param {Result<T>} result - The Result to transform
 * @param {(value: T) => U} transformFn - Function to transform the value
 * @returns {Result<U>} A new Result with the transformed value
 * 
 * @example
 * // Transform a successful Result
 * const userResult = await userService.getUser(id);
 * const sanitizedResult = transformResult(
 *   userResult,
 *   user => sanitizeUser(user)
 * );
 */
export const transformResult = <T, U>(
  result: Result<T>,
  transformFn: (value: T) => U
): Result<U> => {
  if (!result.ok) {
    return result;
  }
  
  try {
    return success(transformFn(result.value));
  } catch (err) {
    return failure({
      message: 'Error transforming result',
      statusCode: 500,
      code: ErrorCode.INTERNAL_ERROR,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Combines multiple results into a single result object
 * 
 * This utility takes multiple Result objects and combines them into a single Result
 * containing an object with the results as properties. If any input Result is a failure,
 * the combined Result will be that failure.
 * 
 * @param {Record<string, Result<any>>} resultMap - Object of named Results
 * @returns {Result<Record<string, any>>} Combined Result object
 * 
 * @example
 * // Combine multiple service results
 * const result = combineResults({
 *   user: await userService.getUser(id),
 *   roles: await roleService.getUserRoles(id),
 *   activity: await activityService.getRecentActivity(id)
 * });
 * 
 * // If all succeed, result.value contains:
 * // { user: {...}, roles: [...], activity: [...] }
 */
export const combineResults = (
  resultMap: Record<string, Result<any>>
): Result<Record<string, any>> => {
  const keys = Object.keys(resultMap);
  
  // Check if any result is a failure
  for (const key of keys) {
    const result = resultMap[key];
    if (!result.ok) {
      return result;
    }
  }
  
  // Combine successful results
  const combinedData: Record<string, any> = {};
  for (const key of keys) {
    combinedData[key] = resultMap[key].value;
  }
  
  return success(combinedData);
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
  // Find the first failure, if any
  const firstFailure = results.find(result => !result.ok);
  if (firstFailure && !firstFailure.ok) {
    return firstFailure;
  }
  
  // Extract values from successful results using type guard
  const values = results.map(result => {
    // Type guard to ensure we only access .value on success results
    if (!result.ok) {
      throw new Error('Unexpected failure in sequenceResults. This should not happen.');
    }
    return result.value;
  });
  
  return success(values);
};

/**
 * Runs asynchronous validation functions in parallel and combines the results
 * 
 * This utility executes multiple async validation functions and either returns
 * a combined failure with all validation errors, or a success with the unchanged input.
 * 
 * @template T The type of data being validated
 * @param {T} data - The data to validate
 * @param {((data: T) => Promise<Result<any>>)[]} validators - Validation functions
 * @returns {Promise<Result<T>>} Result indicating validation success or failures
 * 
 * @example
 * // Validate user data with multiple validation functions
 * const result = await validateAll(
 *   userData,
 *   [
 *     data => validateEmail(data.email),
 *     data => validatePassword(data.password),
 *     data => validateAge(data.age)
 *   ]
 * );
 */
export const validateAll = async <T>(
  data: T,
  validators: ((data: T) => Promise<Result<any>>)[]
): Promise<Result<T>> => {
  // Run all validators in parallel
  const results = await Promise.all(validators.map(validator => validator(data)));
  
  // Collect all validation failures
  const failures = results.filter(result => !result.ok);
  
  if (failures.length > 0) {
    // Combine all validation errors
    const details: Record<string, any> = {};
    failures.forEach((failure, index) => {
      if (!failure.ok && failure.error.details) {
        details[`validation${index}`] = failure.error.details;
      }
    });
    
    return failure({
      message: 'Multiple validation errors',
      statusCode: 400,
      code: ErrorCode.VALIDATION_ERROR,
      details
    });
  }
  
  // All validations passed, return the original data
  return success(data);
};
