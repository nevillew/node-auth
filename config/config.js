require("dotenv").config();

/**
 * Database configuration for different environments
 * @module config/database
 */

/**
 * @typedef {Object} DatabaseConfig
 * @property {string} username - Database user
 * @property {string} password - Database password
 * @property {string} database - Database name
 * @property {string} host - Database host
 * @property {number} port - Database port
 * @property {string} dialect - Database type (e.g. postgres, mysql)
 * @property {Object} [dialectOptions] - Additional database connection options
 */

/**
 * Environment-specific database configurations
 * @type {Object.<string, DatabaseConfig>}
 */
module.exports = {
	/**
	 * Development environment database configuration
	 * Uses environment variables for sensitive data
	 */
	development: {
		username: process.env.DATABASE_USERNAME,
		password: process.env.DATABASE_PASSWORD,
		database: process.env.DATABASE_NAME,
		host: process.env.DATABASE_HOSTNAME,
		port: process.env.DATABASE_PORT,
		dialect: process.env.DATABASE_ENGINE,
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
	},
	/**
	 * Production environment database configuration
	 * Uses SSL connection with relaxed certificate validation
	 * @property {Object} dialectOptions.ssl - SSL configuration for secure connections
	 * @property {boolean} dialectOptions.ssl.require - Enforces SSL usage
	 * @property {boolean} dialectOptions.ssl.rejectUnauthorized - Allows self-signed certificates
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
	},
};
