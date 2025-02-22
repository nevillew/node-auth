const IORedis = require('ioredis');
const { promisify } = require('util');
const logger = require('./logger');
const fallbackCache = require('../services/fallbackCache');

// Cache TTL constants
const CACHE_TTL = {
  SHORT: 300,  // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600,  // 1 hour
  VERY_LONG: 86400 // 24 hours
};

// Redis client options
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
};

// Cache prefixes
const CACHE_PREFIX = {
  USER: 'user:',
  TENANT: 'tenant:',
  ROLE: 'role:',
  SETTINGS: 'settings:'
};

const redisPool = [];
const MAX_POOL_SIZE = process.env.REDIS_POOL_SIZE || 10;
let redisIsDown = false;

const POOL_MIN_SIZE = 5;
const POOL_MAX_SIZE = 20;
const POOL_ACQUIRE_TIMEOUT = 30000;

const createRedisClient = async () => {
  // Check pool size and create new connections if needed
  while (redisPool.length < POOL_MIN_SIZE) {
    const client = await initializeRedisClient();
    redisPool.push(client);
  }

  // Get client from pool with timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Redis connection timeout')), POOL_ACQUIRE_TIMEOUT);
  });

  const clientPromise = new Promise(resolve => {
    if (redisPool.length > 0) {
      resolve(redisPool.pop());
    } else if (redisPool.length < POOL_MAX_SIZE) {
      resolve(initializeRedisClient());
    } else {
      resolve(new Promise(resolve => {
        const checkPool = setInterval(() => {
          if (redisPool.length > 0) {
            clearInterval(checkPool);
            resolve(redisPool.pop());
          }
        }, 100);
      }));
    }
  });

  return Promise.race([clientPromise, timeoutPromise]);

  try {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          const delay = Math.min(retries * 50, 500);
          if (retries > 10) {
            redisIsDown = true;
            logger.error('Redis connection failed after 10 retries, switching to fallback cache');
            return false; // Stop retrying
          }
          return delay;
        }
      },
      readOnly: !!process.env.REDIS_REPLICA_URL
    });

  // Configure failover if replica URL is provided
  if (process.env.REDIS_REPLICA_URL) {
    const replicaClient = createClient({
      url: process.env.REDIS_REPLICA_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      },
      readOnly: true
    });
    
    client.replica = replicaClient;
    await replicaClient.connect();
  }

  // Event handlers
  client.on('error', (err) => {
    logger.error('Redis Client Error', err);
    redisIsDown = true;
  });
  
  client.on('ready', () => {
    logger.info('Redis client ready');
    redisIsDown = false;
  });
  
  client.on('reconnecting', () => logger.info('Redis reconnecting'));
  client.on('end', () => {
    logger.info('Redis connection ended');
    redisIsDown = true;
  });

  try {
    await client.connect();
    return client;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    redisIsDown = true;
    return null;
  }
};

const releaseRedisClient = (client) => {
  if (redisPool.length < MAX_POOL_SIZE) {
    client.select(0);
    redisPool.push(client);
  } else {
    client.quit();
    if (client.replica) {
      client.replica.quit();
    }
  }
};

const withFallback = async (operation, fallbackOperation) => {
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

const get = async (key) => {
  return withFallback(
    async () => {
      const client = await createRedisClient();
      if (!client) throw new Error('No Redis client');
      return client.get(key);
    },
    async () => fallbackCache.get(key)
  );
};

const set = async (key, value, ttl) => {
  return withFallback(
    async () => {
      const client = await createRedisClient();
      if (!client) throw new Error('No Redis client');
      return client.set(key, value, { EX: ttl });
    },
    async () => fallbackCache.set(key, value, ttl)
  );
};

const incr = async (key) => {
  return withFallback(
    async () => {
      const client = await createRedisClient();
      if (!client) throw new Error('No Redis client');
      return client.incr(key);
    },
    async () => fallbackCache.incr(key)
  );
};

module.exports = {
  createRedisClient,
  releaseRedisClient,
  get,
  set,
  incr,
  withFallback
};
