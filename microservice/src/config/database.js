const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

class TenantDatabaseManager {
  constructor() {
    this.connections = new Map();
    this.defaultConfig = {
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: 'postgres',
      logging: msg => logger.debug(msg),
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    };
  }

  async getTenantConnection(tenantId) {
    // Check Redis cache first
    const cachedConfig = await redisService.get(`tenant:${tenantId}:config`);
    
    if (cachedConfig) {
      if (this.connections.has(tenantId)) {
        const connection = this.connections.get(tenantId);
        try {
          await connection.authenticate();
          return connection;
        } catch (error) {
          this.connections.delete(tenantId);
          logger.error(`Cached connection failed for tenant ${tenantId}:`, error);
        }
      }
      
      // Create new connection using cached config
      const connection = new Sequelize(cachedConfig);
      await connection.authenticate();
      this.connections.set(tenantId, connection);
      return connection;
    }

    // Create new connection
    try {
      const connection = new Sequelize({
        ...this.defaultConfig,
        database: `tenant_${tenantId}`
      });

      await connection.authenticate();
      this.connections.set(tenantId, connection);
      logger.info(`Connected to database for tenant ${tenantId}`);
      
      // Cache the connection config
      await redisService.set(`tenant:${tenantId}:config`, {
        ...this.defaultConfig,
        database: `tenant_${tenantId}`
      }, 3600); // Cache for 1 hour
      
      return connection;
    } catch (error) {
      logger.error(`Failed to connect to tenant ${tenantId} database:`, error);
      throw new Error(`Tenant database connection failed: ${error.message}`);
    }
  }

  async closeTenantConnection(tenantId) {
    const connection = this.connections.get(tenantId);
    if (connection) {
      await connection.close();
      this.connections.delete(tenantId);
      logger.info(`Closed connection for tenant ${tenantId}`);
    }
  }

  async closeAllConnections() {
    for (const [tenantId, connection] of this.connections.entries()) {
      await this.closeTenantConnection(tenantId);
    }
  }
}

module.exports = new TenantDatabaseManager();
