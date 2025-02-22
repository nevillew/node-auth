const { Sequelize } = require('sequelize');
const redis = require('redis');
const { createClient } = require('redis');
require('dotenv').config();

// Redis configuration moved to separate redis.js file
const { createRedisClient, releaseRedisClient } = require('./redis');
const REDIS_NAMESPACE = process.env.REDIS_NAMESPACE || 'mt:';

const getRedisClient = async () => {
  if (redisPool.length > 0) {
    return redisPool.pop();
  }

  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 500)
    },
    // Enable read replicas if configured
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
  
  // Add monitoring and management commands
  client.monitor = promisify(client.monitor).bind(client);
  client.info = promisify(client.info).bind(client);
  client.memory = promisify(client.memory).bind(client);
  
  // Add namespace wrapper
  client.getWithNamespace = async (key) => {
    return client.get(`${REDIS_NAMESPACE}${key}`);
  };
  
  client.setWithNamespace = async (key, value, options = {}) => {
    return client.set(`${REDIS_NAMESPACE}${key}`, value, options);
  };
  
  client.delWithNamespace = async (key) => {
    return client.del(`${REDIS_NAMESPACE}${key}`);
  };
  
  // Add cache invalidation helper
  client.invalidateByPattern = async (pattern) => {
    const keys = await client.keys(`${REDIS_NAMESPACE}${pattern}`);
    if (keys.length > 0) {
      return client.del(keys);
    }
    return 0;
  };
  
  // Add memory management
  client.optimizeMemory = async () => {
    await client.configSet('maxmemory-policy', 'allkeys-lru');
    await client.configSet('maxmemory', process.env.REDIS_MAX_MEMORY || '1gb');
  };
  
  return client;
};

// Enhanced connection pool management
const releaseRedisClient = (client) => {
  if (redisPool.length < MAX_POOL_SIZE) {
    // Reset client state before returning to pool
    client.select(0);
    redisPool.push(client);
  } else {
    client.quit();
    if (client.replica) {
      client.replica.quit();
    }
  }
};

// Redis monitoring setup
const setupRedisMonitoring = async () => {
  const client = await createRedisClient();
  
  // Monitor memory usage
  setInterval(async () => {
    try {
      const memoryInfo = await client.memory('STATS');
      logger.info('Redis memory usage:', memoryInfo);
      
      // If memory usage exceeds 90%, trigger optimization
      if (memoryInfo.used_memory / memoryInfo.maxmemory > 0.9) {
        await client.optimizeMemory();
      }
    } catch (error) {
      logger.error('Redis monitoring error:', error);
    }
  }, 60000); // Every minute
  
  // Monitor connection health
  setInterval(async () => {
    try {
      const info = await client.info();
      logger.debug('Redis health check:', info);
    } catch (error) {
      logger.error('Redis health check failed:', error);
    }
  }, 30000); // Every 30 seconds
  
  releaseRedisClient(client);
};

// Initialize monitoring
setupRedisMonitoring();

const config = {
  development: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres'
  },
  test: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: `${process.env.DB_NAME}_test`,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres'
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: `${process.env.DB_NAME}_prod`,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
};

module.exports = config;

class DatabaseManager {
  constructor() {
    this.tenantConnections = new Map();
    this.redisClient = null;
    this.models = require('../models');
    
    // Cleanup on process exit
    process.on('exit', this.cleanup.bind(this));
    process.on('SIGINT', this.cleanup.bind(this));
    process.on('SIGTERM', this.cleanup.bind(this));
  }

  async cleanup() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    for (const [tenantId, connection] of this.tenantConnections) {
      await connection.close();
    }
  }

  async getRedisClient() {
    if (!this.redisClient) {
      this.redisClient = await createRedisClient();
      // Initialize memory optimization
      await this.redisClient.optimizeMemory();
    }
    return this.redisClient;
  }

  async getRedisReplica() {
    const client = await this.getRedisClient();
    if (!client.replica) {
      throw new Error('Redis replica not configured');
    }
    return client.replica;
  }

  async getTenantConnection(tenantId) {
    if (this.tenantConnections.has(tenantId)) {
      return this.tenantConnections.get(tenantId);
    }

    const tenant = await this.models.Tenant.findByPk(tenantId, {
      attributes: ['databaseUrl']
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const sequelize = new Sequelize(tenant.databaseUrl, {
      dialect: 'postgres',
      logging: false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      retry: {
        match: [
          /ETIMEDOUT/,
          /EHOSTUNREACH/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /ETIMEDOUT/,
          /ESOCKETTIMEDOUT/,
          /EHOSTUNREACH/,
          /EPIPE/,
          /EAI_AGAIN/
        ],
        max: 3
      }
    });

    await sequelize.authenticate();
    this.tenantConnections.set(tenantId, sequelize);
    return sequelize;
  }

  async createTenantDatabase(tenantSlug) {
    // Implementation for creating new tenant database
    // This would involve creating a new database and running migrations
  }
}

module.exports.manager = new DatabaseManager();
