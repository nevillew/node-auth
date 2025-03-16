import { Transaction } from 'sequelize';
import { sequelize } from '../models';
import { Result, success, failure, ErrorCode, chainResult } from './errors';
import logger from '../config/logger';

/**
 * @fileoverview
 * This module provides functional utilities for handling database transactions.
 * 
 * Core functional programming patterns used:
 * - Higher-order functions: Functions that take functions as arguments
 * - Railway-oriented programming: Handle the "happy path" and error cases
 * - Function composition: Compose transaction operations cleanly
 * - Pure execution context: Isolate side effects in a controlled context
 */

/**
 * Configuration options for transaction operations
 */
export interface TransactionOptions {
  /** Isolation level for the transaction */
  isolationLevel?: Transaction.ISOLATION_LEVELS;
  /** Whether to auto-retry on serialization failures */
  retry?: boolean;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Whether to auto-commit on success */
  autoCommit?: boolean;
}

/**
 * A higher-order function to wrap database operations in a transaction
 * Handles the common pattern of creating a transaction, executing operations, and handling commits/rollbacks
 * 
 * @template T The return type of the operation
 * @param operation Function containing operations to perform within the transaction
 * @param externalTransaction Optional existing transaction to use
 * @param options Additional transaction options
 * @returns Result of the operation
 * 
 * @example
 * // Basic usage with auto-commit
 * const result = await withTransaction(async (t) => {
 *   const user = await User.create({ name: 'Alice' }, { transaction: t });
 *   await Log.create({ action: 'user_created' }, { transaction: t });
 *   return success(user);
 * });
 * 
 * @example
 * // Using with an existing transaction
 * const outerResult = await withTransaction(async (t) => {
 *   // First operation
 *   const userResult = await createUser(data, t);
 *   if (!userResult.ok) return userResult;
 *   
 *   // Nested transaction (will use the same transaction)
 *   const roleResult = await assignRoles(userResult.value.id, roles, t);
 *   if (!roleResult.ok) return roleResult;
 *   
 *   return success({ user: userResult.value });
 * });
 */
export const withTransaction = async <T>(
  operation: (t: Transaction) => Promise<Result<T>>,
  externalTransaction?: Transaction,
  options: TransactionOptions = {}
): Promise<Result<T>> => {
  // Use provided transaction or create a new one
  const defaultOptions = {
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    retry: true,
    maxRetries: 3,
    autoCommit: true,
    ...options
  };
  
  // Use existing transaction or create a new one
  const isExternalTransaction = !!externalTransaction;
  const t = externalTransaction || await sequelize.transaction({
    isolationLevel: defaultOptions.isolationLevel
  });
  
  let retries = 0;
  
  const executeOperation = async (): Promise<Result<T>> => {
    try {
      // Execute the operation with the transaction
      const result = await operation(t);
      
      // Handle transaction based on result
      if (!isExternalTransaction) {
        if (result.ok && defaultOptions.autoCommit) {
          await t.commit();
        } else if (!result.ok) {
          await t.rollback();
        }
      }
      
      return result;
    } catch (err) {
      // Only rollback if we created the transaction
      if (!isExternalTransaction) {
        await t.rollback();
      }
      
      // Check if we should retry on serialization failures
      const errorMessage = err instanceof Error ? err.message.toLowerCase() : '';
      const isSerializationError = errorMessage.includes('serialization') || 
                                 errorMessage.includes('deadlock') ||
                                 errorMessage.includes('could not serialize');
      
      if (isSerializationError && defaultOptions.retry && retries < defaultOptions.maxRetries) {
        retries++;
        logger.warn(`Transaction serialization error, retrying (${retries}/${defaultOptions.maxRetries})`, { error: err });
        
        // Create a new transaction for retry if we're managing it
        if (!isExternalTransaction) {
          // Mark as finished to avoid multiple rollbacks
          t.finished = true; 
          
          // Create a new transaction and update the reference
          const newTransaction = await sequelize.transaction({
            isolationLevel: defaultOptions.isolationLevel
          });
          
          // Update the closure's transaction reference
          const newOperation = (newTrans: Transaction) => operation(newTrans);
          
          // Execute with new transaction
          return withTransaction(
            newOperation,
            undefined,
            { ...defaultOptions, maxRetries: defaultOptions.maxRetries - retries }
          );
        }
      }
      
      logger.error('Transaction failed:', { error: err });
      return failure({
        message: err instanceof Error ? err.message : 'Transaction failed',
        statusCode: 500,
        code: ErrorCode.TRANSACTION_ERROR,
        originalError: err instanceof Error ? err : new Error('Unknown error')
      });
    }
  };
  
  return executeOperation();
};

/**
 * Executes multiple operations in parallel within a transaction
 * All operations must succeed or the entire transaction is rolled back
 * 
 * @template T The return type of each operation
 * @param operations Array of functions to execute within the transaction
 * @param externalTransaction Optional existing transaction to use
 * @param options Additional transaction options
 * @returns Result containing an array of results from all operations
 * 
 * @example
 * // Execute multiple operations in parallel with transaction safety
 * const result = await withTransactionAll([
 *   t => createUser(userData, t),
 *   t => createProfile(profileData, t),
 *   t => sendWelcomeEmail(emailData, t)
 * ]);
 */
export const withTransactionAll = async <T>(
  operations: ((t: Transaction) => Promise<Result<T>>)[],
  externalTransaction?: Transaction,
  options: TransactionOptions = {}
): Promise<Result<T[]>> => {
  return withTransaction(async (t) => {
    try {
      // Execute all operations in parallel with the same transaction
      const results = await Promise.all(operations.map(op => op(t)));
      
      // Check if any operation failed
      const failedResult = results.find(result => !result.ok);
      if (failedResult && !failedResult.ok) {
        return failedResult as Result<any>;
      }
      
      // Extract values from successful results using a type guard
      const values = results
        .map(result => result.ok ? result.value : null)
        .filter((value): value is T => value !== null);
      
      return success(values);
    } catch (err) {
      logger.error('Transaction with multiple operations failed:', { error: err });
      return failure({
        message: err instanceof Error ? err.message : 'Transaction failed',
        statusCode: 500,
        code: ErrorCode.TRANSACTION_ERROR,
        originalError: err instanceof Error ? err : new Error('Unknown error')
      });
    }
  }, externalTransaction, options);
};

/**
 * Executes a sequence of dependent operations in a transaction, with each step
 * dependent on the success of previous steps.
 * 
 * This implements the functional pattern of "railway-oriented programming" by
 * allowing operations to be chained together while automatically handling
 * the propagation of errors.
 * 
 * @template T The final return type
 * @template I The intermediate result types (inferred)
 * @param initialData The initial data to pass to the first operation
 * @param operations Array of functions to execute in sequence
 * @param externalTransaction Optional existing transaction to use
 * @param options Additional transaction options
 * @returns Result of the final operation
 * 
 * @example
 * // Chain operations where each depends on the previous one
 * const result = await withTransactionChain(
 *   { email: 'user@example.com' }, // Initial data
 *   [
 *     // Create user with email
 *     (data, t) => createUser({ email: data.email }, t),
 *     
 *     // Create profile with user ID from previous step
 *     (user, t) => createProfile({ userId: user.id }, t),
 *     
 *     // Set permissions with user ID from first step
 *     (profile, t) => setPermissions({ userId: profile.userId }, t)
 *   ]
 * );
 */
export const withTransactionChain = async <T, I = any>(
  initialData: I,
  operations: ReadonlyArray<(previousResult: any, t: Transaction) => Promise<Result<any>>>,
  externalTransaction?: Transaction,
  options: TransactionOptions = {}
): Promise<Result<T>> => {
  return withTransaction(async (t) => {
    // Use reduce to chain operations in a more functional way
    return operations.reduce(
      async (previousPromise: Promise<Result<any>>, operation) => {
        const previousResult = await previousPromise;
        
        // Short-circuit on failure
        if (!previousResult.ok) {
          return previousResult;
        }
        
        // Execute next operation with the result of the previous one
        return operation(previousResult.value, t);
      },
      Promise.resolve(success(initialData))
    ) as Promise<Result<T>>;
  }, externalTransaction, options);
};
