import SequelizeOriginal from 'sequelize';
const { Sequelize } = SequelizeOriginal as any;
import { Client } from 'pg';
import { createRedisClient, releaseRedisClient } from './redis';
import logger from './logger';
import tenantController from '../controllers/tenantController';

// Redis monitoring setup
const setupRedisMonitoring = async (): Promise<void> => {
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

interface DatabaseConfig {
  username?: string;
  password?: string;
  database: string;
  host: string;
  port?: string | number;
  dialect: 'postgres' | 'mysql' | 'sqlite' | 'mariadb' | 'mssql';
  pool?: {
    max: number;
    min: number;
    acquire: number;
    idle: number;
  };
  dialectOptions?: {
    ssl?: {
      require: boolean;
      rejectUnauthorized: boolean;
    };
    statement_timeout?: number;
    idle_in_transaction_session_timeout?: number;
  };
  logging: boolean | ((sql: string, timing?: number) => void);
}

interface Config {
  development: DatabaseConfig;
  test: DatabaseConfig;
  production: DatabaseConfig;
}

const config: Config = {
  development: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || '',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT,
    dialect: 'postgres',
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      statement_timeout: 10000, // 10s query timeout
      idle_in_transaction_session_timeout: 30000 // 30s transaction timeout
    },
    logging: false // Disable logging in development
  },
  test: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: `${process.env.DB_NAME}_test`,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: `${process.env.DB_NAME}_prod`,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  }
};

export default config;

export class DatabaseManager {
  private tenantConnectionPools: Map<string, Sequelize>;
  private redisClient: any | null;
  private models: any;
  private maxPoolSize: number;
  private minPoolSize: number;
  private idleTimeout: number;
  private acquireTimeout: number;
  private deletionJob?: NodeJS.Timeout;
  
  constructor() {
    this.tenantConnectionPools = new Map<string, Sequelize>();
    this.redisClient = null;
    // Use dynamic import for models to avoid circular dependencies
    import('../models').then(models => {
      this.models = models;
    });
    this.maxPoolSize = Number(process.env.DB_MAX_POOL_SIZE) || 10;
    this.minPoolSize = Number(process.env.DB_MIN_POOL_SIZE) || 1;
    this.idleTimeout = Number(process.env.DB_IDLE_TIMEOUT) || 10000; // 10 seconds
    this.acquireTimeout = Number(process.env.DB_ACQUIRE_TIMEOUT) || 30000; // 30 seconds
    
    // Cleanup on process exit
    process.on('exit', this.cleanup.bind(this));
    process.on('SIGINT', this.cleanup.bind(this));
    process.on('SIGTERM', this.cleanup.bind(this));
  }

  async cleanup(): Promise<void> {
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

  async startScheduledDeletionJob(): Promise<void> {
    // Run every hour
    this.deletionJob = setInterval(async () => {
      try {
        await tenantController.processScheduledDeletions();
      } catch (error) {
        logger.error('Scheduled deletion job failed:', error);
      }
    }, 60 * 60 * 1000);
  }

  async getRedisClient(): Promise<any> {
    if (!this.redisClient) {
      this.redisClient = await createRedisClient();
      // Initialize memory optimization
      await this.redisClient.optimizeMemory();
    }
    return this.redisClient;
  }

  async getRedisReplica(): Promise<any> {
    const client = await this.getRedisClient();
    if (!client.replica) {
      throw new Error('Redis replica not configured');
    }
    return client.replica;
  }

  async getTenantConnection(tenantId: string): Promise<Sequelize> {
    // Check if we have a pool for this tenant
    if (this.tenantConnectionPools.has(tenantId)) {
      const pool = this.tenantConnectionPools.get(tenantId);
      try {
        // Test connection
        if (pool) {
          await pool.authenticate();
          return pool;
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // Remove broken pool
        this.tenantConnectionPools.delete(tenantId);
        if (pool) await pool.close();
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
        validate: async (connection: any) => {
          try {
            await connection.query('SELECT 1');
            return true;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_error) {
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

  setupPoolMonitoring(sequelize: Sequelize, tenantId: string): void {
    const pool = (sequelize as any).connectionManager.pool;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pool.on('acquire', (_connection: any) => {
      logger.debug(`Connection acquired for tenant ${tenantId}`);
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pool.on('release', (_connection: any) => {
      logger.debug(`Connection released for tenant ${tenantId}`);
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pool.on('destroy', (_connection: any) => {
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

  async createTenantDatabase(tenantSlug: string): Promise<Sequelize> {
    const client = new Client({
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432
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

  async deleteTenantDatabase(tenantSlug: string): Promise<void> {
    const client = new Client({
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432
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

export const manager = new DatabaseManager();