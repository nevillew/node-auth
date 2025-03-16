import dotenv from 'dotenv';
dotenv.config();

/**
 * Database configuration for different environments
 * @module config/database
 */

/**
 * Interface for database configuration
 */
export interface DatabaseConfig {
  /** Database user */
  username: string | undefined;
  /** Database password */
  password: string | null | undefined;
  /** Database name */
  database: string;
  /** Database host */
  host: string;
  /** Database port */
  port: number | string | undefined;
  /** Database type (e.g. postgres, mysql) */
  dialect: 'postgres' | 'mysql' | 'sqlite' | 'mariadb' | 'mssql';
  /** Additional database connection options */
  dialectOptions?: {
    ssl?: {
      require: boolean;
      rejectUnauthorized: boolean;
    };
  };
  /** Pool configuration */
  pool?: {
    max: number;
    min: number;
    acquire: number;
    idle: number;
  };
  /** Logging configuration */
  logging?: boolean | ((sql: string, timing?: number) => void);
}

/**
 * Environment-specific database configurations
 */
interface Config {
  development: DatabaseConfig;
  test: DatabaseConfig;
  production: DatabaseConfig;
}

const config: Config = {
  /**
   * Development environment database configuration
   * Uses environment variables for sensitive data
   */
  development: {
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'multitenant_dev',
    host: process.env.DATABASE_HOSTNAME || '127.0.0.1',
    port: process.env.DATABASE_PORT || 5432,
    dialect: (process.env.DATABASE_ENGINE as 'postgres') || 'postgres',
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    logging: false
  },
  
  /**
   * Test environment database configuration
   * Uses local PostgreSQL instance with default settings
   */
  test: {
    username: process.env.USER,
    password: null,
    database: "multitenant_test",
    host: "127.0.0.1",
    port: 5432,
    dialect: "postgres",
    logging: false
  },
  
  /**
   * Production environment database configuration
   * Uses SSL connection with relaxed certificate validation
   */
  production: {
    username: process.env.USER,
    password: null,
    database: "multitenant_prod",
    host: "127.0.0.1",
    port: 5432,
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false
  },
};

export default config;
