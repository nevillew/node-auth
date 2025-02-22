const { Sequelize } = require('sequelize');

require('dotenv').config();

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
    this.models = require('../models');
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
      logging: false
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
