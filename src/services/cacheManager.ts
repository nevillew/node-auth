import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '../config/logger';
import { Result, success, failure } from '../utils/errors';

interface CacheData {
  [key: string]: any;
}

/**
 * Get a cache key based on file path and content
 */
const getCacheKey = (filePath: string, content: string, cacheDir: string): string => {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return path.join(cacheDir, `${path.basename(filePath)}.${hash.digest('hex')}.cache`);
};

/**
 * Initialize the cache directory
 */
export const initCache = async (cacheDir: string): Promise<Result<boolean>> => {
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    return success(true);
  } catch (err) {
    logger.error('Failed to initialize cache:', { error: err });
    return failure({
      message: 'Failed to initialize cache',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Get data from cache
 */
export const get = async <T>(
  filePath: string, 
  cacheDir: string = '.analyzer-cache',
  cacheMap: Map<string, T> = new Map()
): Promise<Result<T | null>> => {
  try {
    // Initialize cache if needed
    const initResult = await initCache(cacheDir);
    if (!initResult.ok) return initResult;

    const content = await fs.readFile(filePath, 'utf8');
    const cacheKey = getCacheKey(filePath, content, cacheDir);
    
    // Check in-memory cache first
    if (cacheMap.has(cacheKey)) {
      return success(cacheMap.get(cacheKey) as T);
    }

    // Try to read from disk cache
    try {
      const cacheFile = await fs.readFile(cacheKey, 'utf8');
      const cached = JSON.parse(cacheFile) as T;
      cacheMap.set(cacheKey, cached);
      return success(cached);
    } catch (err) {
      // Cache miss, return null
      return success(null);
    }
  } catch (err) {
    logger.error('Failed to get from cache:', { error: err, filePath });
    return failure({
      message: 'Failed to read from cache',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Set data in cache
 */
export const set = async <T>(
  filePath: string, 
  content: string, 
  data: T,
  cacheDir: string = '.analyzer-cache',
  cacheMap: Map<string, T> = new Map()
): Promise<Result<boolean>> => {
  try {
    // Initialize cache if needed
    const initResult = await initCache(cacheDir);
    if (!initResult.ok) return initResult;

    const cacheKey = getCacheKey(filePath, content, cacheDir);
    
    // Store in memory
    cacheMap.set(cacheKey, data);
    
    // Store on disk
    await fs.writeFile(
      cacheKey,
      JSON.stringify(data),
      'utf8'
    );
    
    return success(true);
  } catch (err) {
    logger.error('Failed to write cache:', { error: err, filePath });
    return failure({
      message: 'Failed to write to cache',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

/**
 * Clear the cache
 */
export const clear = async (
  cacheDir: string = '.analyzer-cache',
  cacheMap: Map<string, any> = new Map()
): Promise<Result<boolean>> => {
  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
    cacheMap.clear();
    return success(true);
  } catch (err) {
    logger.error('Failed to clear cache:', { error: err });
    return failure({
      message: 'Failed to clear cache',
      statusCode: 500,
      originalError: err instanceof Error ? err : new Error('Unknown error')
    });
  }
};

// Create and export default cache map for shared use
export const defaultCacheMap = new Map<string, any>();
export const defaultCacheDir = '.analyzer-cache';