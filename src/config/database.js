const { Sequelize } = require('sequelize');
const { createRedisClient, releaseRedisClient } = require('./redis');

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
