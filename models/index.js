'use strict';

import fs from 'fs';
import path from 'path';
import { Sequelize, DataTypes } from 'sequelize';
import process from 'process';
import { fileURLToPath } from 'url';
import { ModelRegistry } from '../src/types';

// Get current file name and directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basename = path.basename(__filename);

// Load environment-specific configuration
const env = process.env.NODE_ENV || 'development';
import config from '../config/config';
const dbConfig = config[env];

// Initialize database object
const db = {};

// Create Sequelize instance
let sequelize;
if (dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable || ''], dbConfig);
} else {
  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);
}

// Load all model files
fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      (file.slice(-3) === '.js' || file.slice(-3) === '.ts') &&
      file.indexOf('.test.') === -1
    );
  })
  .forEach(async file => {
    // Import model dynamically (works with both JS and TS)
    const model = (await import(path.join(__dirname, file))).default(sequelize, DataTypes);
    db[model.name] = model;
  });

// Set up associations between models
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Attach sequelize instance to db object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
