import { Model, ModelStatic, Transaction, WhereOptions } from 'sequelize';
import { Result, success, failure } from './errors';
import logger from '../config/logger';

/**
 * Find an entity by ID with standardized error handling
 * 
 * @param model Sequelize model class
 * @param id Entity ID
 * @param options Additional options for findByPk
 * @returns Result containing the entity or failure
 */
export const findById = async <T extends Model>(
  model: ModelStatic<T>,
  id: string | number,
  options: {
    transaction?: Transaction;
    include?: Array<{
      model: ModelStatic<Model>;
      as?: string;
      include?: any[];
      attributes?: string[];
      required?: boolean;
    }>;
    attributes?: string[];
    errorMessage?: string;
  } = {}
): Promise<Result<T>> => {
  try {
    const entity = await model.findByPk(id, {
      transaction: options.transaction,
      include: options.include,
      attributes: options.attributes
    });
    
    if (!entity) {
      return failure({
        message: options.errorMessage || `${model.name} not found`,
        statusCode: 404
      });
    }
    
    return success(entity);
  } catch (err) {
    logger.error(`Error finding ${model.name}:`, { error: err, id });
    return failure({
      message: `Error retrieving ${model.name}`,
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Find all entities matching criteria with standardized error handling
 * 
 * @param model Sequelize model class
 * @param options Query options
 * @returns Result containing entities or failure
 */
export const findAll = async <T extends Model>(
  model: ModelStatic<T>,
  options: {
    where?: WhereOptions;
    include?: Array<{
      model: ModelStatic<Model>;
      as?: string;
      include?: any[];
      attributes?: string[];
      required?: boolean;
    }>;
    order?: Array<[string, 'ASC' | 'DESC']>;
    limit?: number;
    offset?: number;
    transaction?: Transaction;
    attributes?: string[];
  } = {}
): Promise<Result<T[]>> => {
  try {
    const entities = await model.findAll({
      where: options.where,
      include: options.include,
      order: options.order,
      limit: options.limit,
      offset: options.offset,
      transaction: options.transaction,
      attributes: options.attributes
    });
    
    return success(entities);
  } catch (err) {
    logger.error(`Error finding ${model.name} records:`, { error: err });
    return failure({
      message: `Error retrieving ${model.name} records`,
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Create a new entity with standardized error handling
 * 
 * @param model Sequelize model class
 * @param data Entity data
 * @param options Additional options
 * @returns Result containing the created entity or failure
 */
export const create = async <T extends Model, D extends object>(
  model: ModelStatic<T>,
  data: D,
  options: {
    transaction?: Transaction;
    errorMessage?: string;
  } = {}
): Promise<Result<T>> => {
  try {
    const entity = await model.create(data, {
      transaction: options.transaction
    });
    
    return success(entity);
  } catch (err) {
    logger.error(`Error creating ${model.name}:`, { error: err });
    return failure({
      message: options.errorMessage || `Error creating ${model.name}`,
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Update an entity with standardized error handling
 * 
 * @param entity Sequelize model instance
 * @param data Update data
 * @param options Additional options
 * @returns Result containing the updated entity or failure
 */
export const update = async <T extends Model, D extends object>(
  entity: T,
  data: D,
  options: {
    transaction?: Transaction;
    errorMessage?: string;
  } = {}
): Promise<Result<T>> => {
  try {
    await entity.update(data, {
      transaction: options.transaction
    });
    
    return success(entity);
  } catch (err) {
    logger.error(`Error updating ${entity.constructor.name}:`, { error: err });
    return failure({
      message: options.errorMessage || `Error updating ${entity.constructor.name}`,
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Check if an entity exists with standardized error handling
 * 
 * @param model Sequelize model class
 * @param where Where conditions
 * @param options Additional options
 * @returns Result containing boolean existence check
 */
export const exists = async <T extends Model>(
  model: ModelStatic<T>,
  where: WhereOptions,
  options: {
    transaction?: Transaction;
  } = {}
): Promise<Result<boolean>> => {
  try {
    const count = await model.count({
      where,
      transaction: options.transaction
    });
    
    return success(count > 0);
  } catch (err) {
    logger.error(`Error checking if ${model.name} exists:`, { error: err });
    return failure({
      message: `Error checking if ${model.name} exists`,
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};