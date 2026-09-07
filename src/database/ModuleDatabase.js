const fs = require("fs");
const path = require("path");
const { QueryTypes } = require("sequelize");

// Registers migration metadata only. Execution is an explicit deployment step.
class ModuleDatabase {
    constructor(sequelize) {
        this.sequelize = sequelize;
        this.resources = [];
    }

    registerResources(entry) {
        for (const kind of ["migrations", "seeders"]) {
            for (const relative of entry.module[kind] || []) {
                if (!entry.directory) throw new Error(`Module "${entry.name}" needs a directory for ${kind}.`);
                const filename = path.resolve(entry.directory, relative);
                const inside = path.relative(entry.directory, filename);
                if (path.isAbsolute(relative) || inside === ".." || inside.startsWith(".." + path.sep) || path.isAbsolute(inside) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
                    throw new Error(`Invalid ${kind} resource "${relative}" in module "${entry.name}".`);
                }
                const realInside = path.relative(fs.realpathSync(entry.directory), fs.realpathSync(filename));
                if (realInside === ".." || realInside.startsWith(".." + path.sep) || path.isAbsolute(realInside)) {
                    throw new Error(`Invalid ${kind} resource "${relative}" in module "${entry.name}".`);
                }
                this.resources.push(Object.freeze({ module: entry.name, kind, filename }));
            }
        }
    }

    list(kind) { return this.resources.filter(entry => !kind || entry.kind === kind); }
    transaction(...args) { return this.sequelize.transaction(...args); }

    async ensureMigrationTable() {
        const queryInterface = this.sequelize.getQueryInterface();
        const exists = await queryInterface.tableExists("module_migrations");

        if (exists) {
            return;
        }

        await queryInterface.createTable("module_migrations", {
            id: {
                type: require("sequelize").INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            module: {
                type: require("sequelize").STRING(120),
                allowNull: false
            },
            migration: {
                type: require("sequelize").STRING(255),
                allowNull: false
            },
            executed_at: {
                type: require("sequelize").DATE,
                allowNull: false
            }
        });

        await queryInterface.addConstraint(
            "module_migrations",
            {
                fields: ["module", "migration"],
                type: "unique",
                name: "module_migrations_module_migration_unique"
            }
        );
    }

    async hasMigration(moduleName, migration, transaction) {
        const rows = await this.sequelize.query(
            `SELECT id
             FROM module_migrations
             WHERE module = :module
               AND migration = :migration
             LIMIT 1`,
            {
                replacements: {
                    module: moduleName,
                    migration
                },
                type: QueryTypes.SELECT,
                transaction
            }
        );

        return rows.length > 0;
    }

    async recordMigration(moduleName, migration, transaction) {
        await this.sequelize.query(
            `INSERT INTO module_migrations
                (module, migration, executed_at)
             VALUES
                (:module, :migration, :executedAt)`,
            {
                replacements: {
                    module: moduleName,
                    migration,
                    executedAt: new Date()
                },
                transaction
            }
        );
    }
}

module.exports = ModuleDatabase;
