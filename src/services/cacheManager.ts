import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '../config/logger';
import { Result, success, failure, ErrorCode } from '../utils/errors';

/**
 * Interface for cache data structure
 */
interface CacheData {
  readonly [key: string]: unknown;
}

/**
 * Cache manager service for file-based caching
 */
export class CacheManager {
  private readonly cacheMap: Map<string, unknown>;
  private readonly cacheDir: string;

  /**
   * Create a new cache manager instance
   * 
   * @param cacheDir - Directory to store cache files
   */
  constructor(cacheDir: string = '.analyzer-cache') {
    this.cacheMap = new Map<string, unknown>();
    this.cacheDir = cacheDir;
  }

  /**
   * Get a cache key based on file path and content (pure function)
   * 
   * @param filePath - Path to the file
   * @param content - Content of the file
   * @returns Cache key string
   */
  private getCacheKey(filePath: string, content: string): string {
    // Create a new hash instance for each call to maintain purity
    const hash = crypto.createHash('sha256');
    const contentHash = hash.update(content).digest('hex');
    const fileName = path.basename(filePath);
    
    // Construct the cache key in a pure way
    return path.join(this.cacheDir, `${fileName}.${contentHash}.cache`);
  }

  /**
   * Initialize the cache directory
   * 
   * @returns Result indicating success or failure
   */
  public async initCache(): Promise<Result<boolean>> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      return success(true);
    } catch (err) {
      logger.error('Failed to initialize cache:', { error: err });
      return failure({
        message: 'Failed to initialize cache',
        statusCode: 500,
        code: ErrorCode.CACHE_ERROR,
        originalError: err instanceof Error ? err : new Error('Unknown error'),
        source: 'CacheManager.initCache'
      });
    }
  }

  /**
   * Get data from cache
   * 
   * @param filePath - Path to the file
   * @returns Result containing cached data or null if not found
   */
  public async get<T>(filePath: string): Promise<Result<T | null>> {
    try {
      // Initialize cache if needed
      const initResult = await this.initCache();
      if (!initResult.ok) return initResult;

      const content = await fs.readFile(filePath, 'utf8');
      const cacheKey = this.getCacheKey(filePath, content);
      
      // Check in-memory cache first
      if (this.cacheMap.has(cacheKey)) {
        return success(this.cacheMap.get(cacheKey) as T);
      }

      // Try to read from disk cache
      try {
        const cacheFile = await fs.readFile(cacheKey, 'utf8');
        const cached = JSON.parse(cacheFile) as T;
        this.cacheMap.set(cacheKey, cached);
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
        code: ErrorCode.CACHE_MISS,
        originalError: err instanceof Error ? err : new Error('Unknown error')
      });
    }
  }

  /**
   * Set data in cache
   * 
   * @param filePath - Path to the file
   * @param content - Content of the file
   * @param data - Data to cache
   * @returns Result indicating success or failure
   */
  public async set<T>(filePath: string, content: string, data: T): Promise<Result<boolean>> {
    try {
      // Initialize cache if needed
      const initResult = await this.initCache();
      if (!initResult.ok) return initResult;

      const cacheKey = this.getCacheKey(filePath, content);
      
      // Store in memory
      this.cacheMap.set(cacheKey, data);
      
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
        code: ErrorCode.CACHE_ERROR,
        originalError: err instanceof Error ? err : new Error('Unknown error')
      });
    }
  }

  /**
   * Clear the cache
   * 
   * @returns Result indicating success or failure
   */
  public async clear(): Promise<Result<boolean>> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      this.cacheMap.clear();
      return success(true);
    } catch (err) {
      logger.error('Failed to clear cache:', { error: err });
      return failure({
        message: 'Failed to clear cache',
        statusCode: 500,
        code: ErrorCode.CACHE_ERROR,
        originalError: err instanceof Error ? err : new Error('Unknown error')
      });
    }
  }
}

// Create and export default cache manager instance for shared use
export const cacheManager = new CacheManager();
