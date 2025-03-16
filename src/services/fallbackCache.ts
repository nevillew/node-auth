import NodeCache from 'node-cache';
import { Result, success, failure } from '../utils/errors';

// Initialize in-memory cache
const cache = new NodeCache({
  stdTTL: 600, // 10 minutes default TTL
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false
});

// Flag to track Redis status
let isRedisDown = false;

/**
 * Get a value from the cache
 */
export const get = async <T>(key: string): Promise<Result<T | undefined>> => {
  try {
    const value = cache.get<T>(key);
    return success(value);
  } catch (err) {
    return failure({
      message: 'Error retrieving from fallback cache',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Set a value in the cache
 */
export const set = async <T>(
  key: string, 
  value: T, 
  ttl?: number
): Promise<Result<boolean>> => {
  try {
    const result = cache.set<T>(key, value, ttl);
    return success(result);
  } catch (err) {
    return failure({
      message: 'Error setting value in fallback cache',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Delete a value from the cache
 */
export const del = async (key: string): Promise<Result<number>> => {
  try {
    const deletedCount = cache.del(key);
    return success(deletedCount);
  } catch (err) {
    return failure({
      message: 'Error deleting from fallback cache',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Increment a value in the cache
 */
export const incr = async (key: string): Promise<Result<number>> => {
  try {
    const value = (cache.get<number>(key) || 0) + 1;
    cache.set<number>(key, value);
    return success(value);
  } catch (err) {
    return failure({
      message: 'Error incrementing value in fallback cache',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Set expiration on a cache key
 */
export const expire = async (
  key: string, 
  seconds: number
): Promise<Result<boolean>> => {
  try {
    const value = cache.get(key);
    if (value === undefined) {
      return success(false);
    }
    
    const result = cache.ttl(key, seconds);
    return success(result);
  } catch (err) {
    return failure({
      message: 'Error setting expiration in fallback cache',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Set Redis down status
 */
export const setRedisDown = (status: boolean): void => {
  isRedisDown = status;
};

/**
 * Check if Redis is down
 */
export const isRedisDownStatus = (): boolean => {
  return isRedisDown;
};
