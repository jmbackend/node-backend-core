const fs = require("fs");
const path = require("path");
const os = require("os");
const ModuleMigrationRunner = require("../../../src/core/migrations/ModuleMigrationRunner");

function migrationFixture(source) {
    const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), "module-migration-runner-")
    );
    const filename = path.join(directory, "migrations.js");

    fs.writeFileSync(filename, source);

    return {
        directory,
        filename,
        cleanup() {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    };
}

function logger() {
    return {
        info: jest.fn(),
        error: jest.fn()
    };
}

afterEach(() => {
    jest.resetModules();
});

test("runs migrations in entry order and records each migration", async () => {
    const fixture = migrationFixture(`
        module.exports = {
            up: async (queryInterface, Sequelize, transaction) => {
                await queryInterface.runMigration("users", transaction);
            }
        };
    `);
    const calls = [];
    const database = {
        sequelize: {
            getQueryInterface: () => ({
                runMigration: async (name) => calls.push(name)
            })
        },
        ensureMigrationTable: jest.fn(),
        list: jest.fn(() => [
            {
                module: "users",
                filename: fixture.filename
            }
        ]),
        hasMigration: jest.fn().mockResolvedValue(false),
        recordMigration: jest.fn().mockResolvedValue(undefined),
        transaction: jest.fn(async callback => callback({ id: "transaction" }))
    };
    const runner = new ModuleMigrationRunner(database, logger());

    try {
        await runner.run([
            {
                name: "users",
                directory: fixture.directory
            }
        ]);
    } finally {
        fixture.cleanup();
    }

    expect(calls).toEqual(["users"]);
    expect(database.recordMigration).toHaveBeenCalledWith(
        "users",
        "migrations.js",
        { id: "transaction" }
    );
});

test("skips a migration that was already recorded", async () => {
    const fixture = migrationFixture(`
        module.exports = {
            up: jest.fn()
        };
    `);
    const database = {
        sequelize: {
            getQueryInterface: () => ({})
        },
        ensureMigrationTable: jest.fn(),
        list: jest.fn(() => [
            {
                module: "users",
                filename: fixture.filename
            }
        ]),
        hasMigration: jest.fn().mockResolvedValue(true),
        transaction: jest.fn()
    };
    const output = logger();
    const runner = new ModuleMigrationRunner(database, output);

    try {
        await runner.run([
            {
                name: "users",
                directory: fixture.directory
            }
        ]);
    } finally {
        fixture.cleanup();
    }

    expect(database.transaction).not.toHaveBeenCalled();
    expect(output.info).toHaveBeenCalledWith("SKIP users:migrations.js");
});

test("does not record a migration when up fails", async () => {
    const fixture = migrationFixture(`
        module.exports = {
            up: async () => {
                throw new Error("migration failed");
            }
        };
    `);
    const database = {
        sequelize: {
            getQueryInterface: () => ({})
        },
        ensureMigrationTable: jest.fn(),
        list: jest.fn(() => [
            {
                module: "auth",
                filename: fixture.filename
            }
        ]),
        hasMigration: jest.fn().mockResolvedValue(false),
        recordMigration: jest.fn(),
        transaction: jest.fn(async callback => callback({ id: "transaction" }))
    };
    const runner = new ModuleMigrationRunner(database, logger());

    try {
        await expect(
            runner.run([
                {
                    name: "auth",
                    directory: fixture.directory
                }
            ])
        ).rejects.toThrow("migration failed");
    } finally {
        fixture.cleanup();
    }

    expect(database.recordMigration).not.toHaveBeenCalled();
});

test("ignores modules without migrations", async () => {
    const database = {
        ensureMigrationTable: jest.fn(),
        list: jest.fn(() => [])
    };
    const output = logger();
    const runner = new ModuleMigrationRunner(database, output);

    await runner.run([{ name: "empty" }]);

    expect(output.info).toHaveBeenCalledWith(
        "No migrations for module: empty"
    );
});
