require("dotenv").config({ quiet: true });

const moduleConfig = require("../config/modules");
const ModuleLoader = require("../core/modules/ModuleLoader");
const ModuleDatabase = require("../database/ModuleDatabase");
const ModuleMigrationRunner = require("../core/migrations/ModuleMigrationRunner");
const sequelize = require("../database");
const logger = require("../common/logger/Logger");

async function migrate() {
    const database = new ModuleDatabase(sequelize);
    const loader = new ModuleLoader({
        packages: moduleConfig.modules,
        context: {
            sequelize,
            database,
            logger
        }
    });

    try {
        await sequelize.authenticate();
        logger.info("Database connection established.");
        logger.info("Discovering modules...");

        loader.discover();
        const order = loader.resolveOrder();

        for (const entry of order) {
            database.registerResources(entry);
        }

        const runner = new ModuleMigrationRunner(database, logger);
        await runner.run(order);

        logger.info("Migrations completed successfully.");
    } finally {
        await sequelize.close();
    }
}

if (require.main === module) {
    migrate().catch(error => {
        logger.error(`Migration process failed: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = migrate;
