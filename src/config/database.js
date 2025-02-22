const { Sequelize } = require('sequelize');
const redis = require('redis');
const { createClient } = require('redis');
require('dotenv').config();

// Redis client factory
const redis = require('redis');
const { createClient } = require('redis');
const { promisify } = require('util');

const redisPool = [];
const MAX_POOL_SIZE = 10;

const createRedisClient = async () => {
  if (redisPool.length > 0) {
    return redisPool.pop();
  }

  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 500)
    }
  });

  client.on('error', (err) => console.error('Redis Client Error', err));
  client.on('ready', () => console.log('Redis client ready'));
  client.on('reconnecting', () => console.log('Redis reconnecting'));
  
  await client.connect();
  
  // Add monitoring commands
  client.monitor = promisify(client.monitor).bind(client);
  client.info = promisify(client.info).bind(client);
  
  return client;
};

const releaseRedisClient = (client) => {
  if (redisPool.length < MAX_POOL_SIZE) {
    redisPool.push(client);
  } else {
    client.quit();
  }
};

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
    }
    return this.redisClient;
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
