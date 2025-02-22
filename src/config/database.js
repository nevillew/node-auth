const { Sequelize } = require('sequelize');
const { createRedisClient, releaseRedisClient } = require('./redis');


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
    this.tenantConnectionPools = new Map();
    this.redisClient = null;
    this.models = require('../models');
    this.maxPoolSize = process.env.DB_MAX_POOL_SIZE || 10;
    this.minPoolSize = process.env.DB_MIN_POOL_SIZE || 1;
    this.idleTimeout = process.env.DB_IDLE_TIMEOUT || 10000; // 10 seconds
    this.acquireTimeout = process.env.DB_ACQUIRE_TIMEOUT || 30000; // 30 seconds
    
    // Cleanup on process exit
    process.on('exit', this.cleanup.bind(this));
    process.on('SIGINT', this.cleanup.bind(this));
    process.on('SIGTERM', this.cleanup.bind(this));
  }

  async cleanup() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    // Close all connection pools
    for (const [tenantId, pool] of this.tenantConnectionPools) {
      try {
        await pool.close();
      } catch (error) {
        logger.error(`Error closing pool for tenant ${tenantId}:`, error);
      }
    }
    
    // Clear scheduled deletion job
    if (this.deletionJob) {
      clearInterval(this.deletionJob);
    }
  }

  async startScheduledDeletionJob() {
    // Run every hour
    this.deletionJob = setInterval(async () => {
      try {
        await tenantController.processScheduledDeletions();
      } catch (error) {
        logger.error('Scheduled deletion job failed:', error);
      }
    }, 60 * 60 * 1000);
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
    // Check if we have a pool for this tenant
    if (this.tenantConnectionPools.has(tenantId)) {
      const pool = this.tenantConnectionPools.get(tenantId);
      try {
        // Test connection
        await pool.authenticate();
        return pool;
      } catch (error) {
        // Remove broken pool
        this.tenantConnectionPools.delete(tenantId);
        await pool.close();
      }
    }

    const tenant = await this.models.Tenant.findByPk(tenantId, {
      attributes: ['databaseUrl']
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Create new connection pool
    const sequelize = new Sequelize(tenant.databaseUrl, {
      dialect: 'postgres',
      logging: false,
      pool: {
        max: this.maxPoolSize,
        min: this.minPoolSize,
        acquire: this.acquireTimeout,
        idle: this.idleTimeout,
        evict: this.idleTimeout, // Remove idle connections
        validate: async (connection) => {
          try {
            await connection.query('SELECT 1');
            return true;
          } catch (error) {
            return false;
          }
        }
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
    this.tenantConnectionPools.set(tenantId, sequelize);
    
    // Setup pool monitoring
    this.setupPoolMonitoring(sequelize, tenantId);
    
    return sequelize;
  }

  setupPoolMonitoring(sequelize, tenantId) {
    const pool = sequelize.connectionManager.pool;

    pool.on('acquire', (connection) => {
      logger.debug(`Connection acquired for tenant ${tenantId}`);
    });

    pool.on('release', (connection) => {
      logger.debug(`Connection released for tenant ${tenantId}`);
    });

    pool.on('destroy', (connection) => {
      logger.debug(`Connection destroyed for tenant ${tenantId}`);
    });

    // Monitor pool size
    setInterval(() => {
      logger.debug(`Pool stats for tenant ${tenantId}:`, {
        size: pool.size,
        available: pool.available,
        waiting: pool.waiting,
        using: pool.using
      });
    }, 60000); // Every minute
  }

  async createTenantDatabase(tenantSlug) {
    const client = new Client({
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT
    });

    try {
      await client.connect();
      
      // Create database
      await client.query(`CREATE DATABASE "${tenantSlug}"`);
      
      // Create schema
      const tenantDb = new Sequelize(
        `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${tenantSlug}`
      );
      
      // Run migrations
      await tenantDb.authenticate();
      await tenantDb.sync();
      
      return tenantDb;
    } finally {
      await client.end();
    }
  }

  async deleteTenantDatabase(tenantSlug) {
    const client = new Client({
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT
    });

    try {
      await client.connect();
      
      // Disconnect all active connections
      await client.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
          AND pid <> pg_backend_pid();
      `, [tenantSlug]);

      // Drop database
      await client.query(`DROP DATABASE "${tenantSlug}"`);
    } finally {
      await client.end();
    }
  }
}

module.exports.manager = new DatabaseManager();
