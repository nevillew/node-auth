const redis = require('redis');
const { createClient } = require('redis');
const { promisify } = require('util');
const logger = require('./logger');
const fallbackCache = require('../services/fallbackCache');

const redisPool = [];
const MAX_POOL_SIZE = process.env.REDIS_POOL_SIZE || 10;
let redisIsDown = false;

const createRedisClient = async () => {
  if (redisPool.length > 0) {
    return redisPool.pop();
  }

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
