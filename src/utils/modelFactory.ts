/**
 * @fileoverview
 * This module provides a higher-order function for defining Sequelize models
 * in a consistent, functional way that leverages TypeScript's type system.
 * 
 * Core functional programming patterns used:
 * - Higher-order functions: Functions that return functions
 * - Pure functions: No side effects in model definition
 * - Immutability: Model definitions are created, not modified
 * - Function composition: Combining associate functions
 */

import { Sequelize, ModelAttributes, ModelOptions, Model } from 'sequelize';
import { AssociableModel, ModelRegistry } from '../types';

/**
 * Interface for model definition input
 */
export interface ModelDefinitionInput<T, C = T> {
  /** Model name */
  name: string;
  /** Model attributes */
  attributes: ModelAttributes<Model<T, C>, T>;
  /** Model options */
  options: ModelOptions;
  /** Associate function for defining relationships */
  associate?: (models: ModelRegistry) => void;
}

/**
 * Higher-order function to create a model definition function
 * 
 * This function follows the functional programming pattern of creating
 * a factory function that returns another function. The returned function
 * is a model definer that incorporates all the standard patterns:
 * - Consistent typing with AssociableModel
 * - Proper association handling
 * - Standard options configuration
 * 
 * @template T The model's attributes type
 * @template C The model's creation attributes type (defaults to T)
 * @param {ModelDefinitionInput<T, C>} input - Model definition parameters
 * @returns {(sequelize: Sequelize) => AssociableModel<T, C>} A model definer function
 * 
 * @example
 * // Define a user model using the factory
 * export const defineUserModel = createModelDefiner({
 *   name: 'User',
 *   attributes: {
 *     id: { type: DataTypes.UUID, primaryKey: true },
 *     name: { type: DataTypes.STRING, allowNull: false }
 *   },
 *   options: {
 *     tableName: 'Users',
 *     timestamps: true
 *   },
 *   associate: (models) => {
 *     // Define associations here
 *   }
 * });
 */
export const createModelDefiner = <T, C = T>({
  name,
  attributes,
  options,
  associate = () => {} // Default empty function
}: ModelDefinitionInput<T, C>) => {
  /**
   * Model definition function
   * 
   * @param {Sequelize} sequelize - Sequelize instance
   * @returns {AssociableModel<T, C>} The defined model
   */
  return (sequelize: Sequelize): AssociableModel<T, C> => {
    // Define the model with proper generic typing
    const model = sequelize.define<AssociableModel<T, C>>(
      name,
      attributes,
      {
        // Default options that can be overridden
        timestamps: true,
        ...options
      }
    );
    
    // Attach the associate method directly
    model.associate = associate;
    
    return model;
  };
};

/**
 * Combines multiple association functions into one
 * 
 * This enables breaking down complex associations into smaller,
 * focused functions and then combining them.
 * 
 * @param {((models: ModelRegistry) => void)[]} associateFns - Functions to combine
 * @returns {(models: ModelRegistry) => void} Combined association function
 * 
 * @example
 * // Define multiple association functions
 * const userTenantAssociations = (models) => { /* associations */ };
 * const userRoleAssociations = (models) => { /* associations */ };
 * 
 * // Combine them
 * const userAssociations = combineAssociations([
 *   userTenantAssociations,
 *   userRoleAssociations
 * ]);
 */
export const combineAssociations = (
  associateFns: ((models: ModelRegistry) => void)[]
): ((models: ModelRegistry) => void) => {
  return (models: ModelRegistry): void => {
    // Execute each association function with the models
    associateFns.forEach(fn => fn(models));
  };
};