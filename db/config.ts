import { Options } from 'sequelize';

export const dbConfig: Options = {
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // Connection pool settings
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '5'),
    min: parseInt(process.env.DB_POOL_MIN || '0'),
    acquire: 30000,
    idle: 10000
  },

  // SSL configuration for production
  dialectOptions: process.env.NODE_ENV === 'production' ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {},

  // Logging configuration
  logging: process.env.NODE_ENV === 'development' ? 
    (msg: string) => console.log(`[Sequelize] ${msg}`) : 
    false,

  // Timezone configuration  
  timezone: '+00:00',

  // Define options
  define: {
    timestamps: true,
    paranoid: true,
    underscored: true,
    freezeTableName: true
  }
};
