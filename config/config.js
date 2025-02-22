require('dotenv').config();

module.exports = {
  development: {
    username: process.env.USER,
    password: null,
    database: "multitenant_dev",
    host: "127.0.0.1",
    port: 5432,
    dialect: "postgres"
  },
  test: {
    username: process.env.USER,
    password: null,
    database: "multitenant_test",
    host: "127.0.0.1",
    port: 5432,
    dialect: "postgres"
  },
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
        rejectUnauthorized: false
      }
    }
  }
};
