const { Sequelize } = require("sequelize");

const config = require("../config").database;

const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
        host: config.host,
        port: config.port,
        dialect: config.dialect,
        logging: false,
        dialectOptions: { connectTimeout: 5000 },
        pool: { acquire: 5000 },
    }
);

module.exports = sequelize;
