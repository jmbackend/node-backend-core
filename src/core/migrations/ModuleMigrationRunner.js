const path = require("path");
const { Sequelize } = require("sequelize");

class ModuleMigrationRunner {
    constructor(database, logger = console) {
        this.database = database;
        this.logger = logger;
    }

    async run(entries) {
        await this.database.ensureMigrationTable();

        for (const entry of entries) {
            await this.runModule(entry);
        }
    }

    async runModule(entry) {
        const migrations = this.database
            .list("migrations")
            .filter(resource => resource.module === entry.name);

        if (migrations.length === 0) {
            this.logger.info(`No migrations for module: ${entry.name}`);
            return;
        }

        this.logger.info(`Migrating module: ${entry.name}`);

        for (const resource of migrations) {
            await this.runMigration(entry, resource);
        }
    }

    async runMigration(entry, resource) {
        const migrationName = path.relative(
            entry.directory,
            resource.filename
        ).replace(/\\/g, "/");
        const label = `${entry.name}:${migrationName}`;

        if (await this.database.hasMigration(entry.name, migrationName)) {
            this.logger.info(`SKIP ${label}`);
            return;
        }

        this.logger.info(`RUN  ${label}`);

        try {
            await this.database.transaction(async transaction => {
                const alreadyApplied = await this.database.hasMigration(
                    entry.name,
                    migrationName,
                    transaction
                );

                if (alreadyApplied) {
                    return;
                }

                const migration = require(resource.filename);

                if (!migration || typeof migration.up !== "function") {
                    throw new Error(
                        `Migration "${label}" must export an up function.`
                    );
                }

                await migration.up(
                    this.database.sequelize.getQueryInterface(),
                    Sequelize,
                    transaction
                );

                await this.database.recordMigration(
                    entry.name,
                    migrationName,
                    transaction
                );
            });

            this.logger.info(`DONE ${label}`);
        } catch (error) {
            this.logger.error(
                `Migration failed: ${label}: ${error.message}`
            );
            throw error;
        }
    }
}

module.exports = ModuleMigrationRunner;
