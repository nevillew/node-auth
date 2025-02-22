require("dotenv").config();

module.exports = {
	development: {
		username: process.env.DATABASE_USERNAME,
		password: process.env.DATABASE_PASSWORD,
		database: process.env.DATABASE_NAME,
		host: process.env.DATABASE_HOSTNAME,
		port: process.env.DATABASE_PORT,
		dialect: process.env.DATABASE_ENGINE,
	},
	test: {
		username: process.env.USER,
		password: null,
		database: "multitenant_test",
		host: "127.0.0.1",
		port: 5432,
		dialect: "postgres",
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
				rejectUnauthorized: false,
			},
		},
	},
};
