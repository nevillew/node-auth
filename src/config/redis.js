const redis = require('redis');
const { createClient } = require('redis');
const { promisify } = require('util');
const logger = require('./logger');

const redisPool = [];
const MAX_POOL_SIZE = process.env.REDIS_POOL_SIZE || 10;

const createRedisClient = async () => {
  if (redisPool.length > 0) {
    return redisPool.pop();
  }

  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 500)
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
  client.on('error', (err) => logger.error('Redis Client Error', err));
  client.on('ready', () => logger.info('Redis client ready'));
  client.on('reconnecting', () => logger.info('Redis reconnecting'));
  client.on('end', () => logger.info('Redis connection ended'));
  
  await client.connect();
  
  return client;
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

module.exports = {
  createRedisClient,
  releaseRedisClient
};
