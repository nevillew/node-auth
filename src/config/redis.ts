import IORedis from 'ioredis';
import { promisify } from 'util';
import logger from './logger';
import * as fallbackCache from '../services/fallbackCache';

// Cache TTL constants
export const CACHE_TTL = {
  SHORT: 300,  // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600,  // 1 hour
  VERY_LONG: 86400 // 24 hours
};

// Redis client options
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: Number(process.env.REDIS_DB) || 0,
  retryStrategy: (times: number): number => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
};

// Cache prefixes
export const CACHE_PREFIX = {
  USER: 'user:',
  TENANT: 'tenant:',
  ROLE: 'role:',
  SETTINGS: 'settings:'
};

interface RedisClient extends IORedis.Redis {
  optimizeMemory(): Promise<void>;
  memory(command: string): Promise<any>;
  replica?: IORedis.Redis;
}

const redisPool: RedisClient[] = [];
const MAX_POOL_SIZE = Number(process.env.REDIS_POOL_SIZE) || 10;
let redisIsDown = false;

const POOL_MIN_SIZE = 5;
const POOL_MAX_SIZE = 20;
const POOL_ACQUIRE_TIMEOUT = 30000;

// Initialize Redis client with additional methods
const initializeRedisClient = async (): Promise<RedisClient> => {
  const client = new IORedis(redisOptions) as RedisClient;
  
  // Add custom methods
  client.optimizeMemory = async function() {
    // Example optimization
    await this.config('SET', 'maxmemory-policy', 'allkeys-lru');
  };
  
  client.memory = async function(command: string): Promise<any> {
    try {
      const info = await this.info('memory');
      const lines = info.split('\r\n');
      const stats: Record<string, any> = {};
      
      lines.forEach((line: string) => {
        const match = line.match(/^(used_memory.*?):(.*?)$/);
        if (match) {
          stats[match[1]] = parseInt(match[2].trim(), 10);
        }
      });
      
      // Add maxmemory from config
      const maxmemory = await this.config('GET', 'maxmemory');
      if (maxmemory && maxmemory[1]) {
        stats.maxmemory = parseInt(maxmemory[1], 10);
      } else {
        stats.maxmemory = 0;
      }
      
      return stats;
    } catch (error) {
      logger.error('Failed to get Redis memory stats:', error);
      return { used_memory: 0, maxmemory: 0 };
    }
  };
  
  // Setup event handlers
  client.on('error', (err: Error) => {
    logger.error('Redis Client Error', err);
    redisIsDown = true;
  });
  
  client.on('ready', () => {
    logger.info('Redis client ready');
    redisIsDown = false;
  });
  
  return client;
};

export const createRedisClient = async (): Promise<RedisClient> => {
  // Check pool size and create new connections if needed
  while (redisPool.length < POOL_MIN_SIZE) {
    try {
      const client = await initializeRedisClient();
      redisPool.push(client);
    } catch (error) {
      logger.error('Failed to initialize Redis client for pool:', error);
      break;
    }
  }

  // Get client from pool with timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Redis connection timeout')), POOL_ACQUIRE_TIMEOUT);
  });

  const clientPromise = new Promise<RedisClient>(resolve => {
    if (redisPool.length > 0) {
      resolve(redisPool.pop()!);
    } else if (redisPool.length < POOL_MAX_SIZE) {
      resolve(initializeRedisClient());
    } else {
      const checkInterval = setInterval(() => {
        if (redisPool.length > 0) {
          clearInterval(checkInterval);
          resolve(redisPool.pop()!);
        }
      }, 100);
    }
  });

  try {
    return await Promise.race([clientPromise, timeoutPromise]);
  } catch (error) {
    logger.error('Failed to acquire Redis client from pool:', error);
    redisIsDown = true;
    throw error;
  }
};

export const releaseRedisClient = (client: RedisClient): void => {
  if (!client) return;
  
  if (redisPool.length < MAX_POOL_SIZE) {
    try {
      client.select(0);
      redisPool.push(client);
    } catch (error) {
      client.quit().catch(err => logger.error('Error quitting Redis client:', err));
    }
  } else {
    client.quit().catch(err => logger.error('Error quitting Redis client:', err));
    if (client.replica) {
      client.replica.quit().catch(err => logger.error('Error quitting Redis replica:', err));
    }
  }
};

export const withFallback = async <T>(
  operation: () => Promise<T>, 
  fallbackOperation: () => Promise<T>
): Promise<T> => {
  if (redisIsDown) {
    logger.debug('Redis is down, using fallback cache');
    return fallbackOperation();
  }

  try {
    return await operation();
  } catch (error) {
    logger.error('Redis operation failed, using fallback:', error);
    redisIsDown = true;
    return fallbackOperation();
  }
};

export const get = async (key: string): Promise<string | null> => {
  return withFallback(
    async () => {
      const client = await createRedisClient();
      if (!client) throw new Error('No Redis client');
      try {
        return await client.get(key);
      } finally {
        releaseRedisClient(client);
      }
    },
    async () => fallbackCache.get(key)
  );
};

export const set = async (key: string, value: string, ttl: number): Promise<string> => {
  return withFallback(
    async () => {
      const client = await createRedisClient();
      if (!client) throw new Error('No Redis client');
      try {
        return await client.set(key, value, 'EX', ttl);
      } finally {
        releaseRedisClient(client);
      }
    },
    async () => fallbackCache.set(key, value, ttl)
  );
};

export const incr = async (key: string): Promise<number> => {
  return withFallback(
    async () => {
      const client = await createRedisClient();
      if (!client) throw new Error('No Redis client');
      try {
        return await client.incr(key);
      } finally {
        releaseRedisClient(client);
      }
    },
    async () => fallbackCache.incr(key)
  );
};