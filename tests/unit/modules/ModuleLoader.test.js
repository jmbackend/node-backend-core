const fs = require("fs");
const path = require("path");
const ModuleLoader = require("../../../src/core/modules/ModuleLoader");
const ModuleRegistry = require("../../../src/core/modules/ModuleRegistry");
const ModuleValidator = require("../../../src/core/modules/ModuleValidator");
const ModuleDatabase = require("../../../src/database/ModuleDatabase");
const { fixture, logger } = require("../../helpers/modules");

let fixtures = [];
afterEach(() => { fixtures.forEach(f => f.cleanup()); fixtures = []; });
function directory(modules) { const f = fixture(modules); fixtures.push(f); return f.root; }
function moduleOf(name, overrides = {}) { return { name, version: "1.0.0", register: jest.fn(), ...overrides }; }
function loaderFor(modules, context = {}) {
    const registry = new ModuleRegistry();
    modules.forEach(module => registry.register(module));
    return new ModuleLoader({ registry, directory: directory({}), context: { logger: logger(), ...context } });
}

test("discovers an entrypoint and invokes async lifecycle with context", async () => {
    const calls = [];
    const root = directory({ example: `module.exports = {
        name: "example", version: "1.0.0",
        async register(c) { c.calls.push("register"); },
        async boot(c) { c.calls.push("boot"); },
        async shutdown(c) { c.calls.push("shutdown"); }
    };` });
    const loader = new ModuleLoader({ directory: root, context: { calls } });
    await loader.initialize();
    expect(loader.registry.has("example")).toBe(true);
    expect(loader.registry.get("example")).toMatchObject({ version: "1.0.0", state: "registered", dependencies: [] });
    await loader.boot();
    expect(loader.registry.get("example").state).toBe("booted");
    await loader.shutdown();
    await loader.shutdown();
    expect(calls).toEqual(["register", "boot", "shutdown"]);
    expect(loader.registry.get("example").state).toBe("stopped");
});
test("empty and missing directories work", async () => {
    for (const root of [directory({}), path.join(directory({}), "missing")]) {
        const loader = new ModuleLoader({ directory: root });
        await loader.initialize(); await loader.boot(); await loader.shutdown();
        expect(loader.registry.list()).toEqual([]);
    }
});
test("invalid directories fail clearly", async () => {
    const root = directory({});
    fs.mkdirSync(path.join(root, "invalid"));
    await expect(new ModuleLoader({ directory: root }).initialize()).rejects.toThrow("missing index.js");
});
test("dependencies order every lifecycle stage and reverse shutdown", async () => {
    const calls = [];
    const make = (name, dependencies) => moduleOf(name, Object.fromEntries([
        ["dependencies", dependencies],
        ...["registerModels", "associate", "register", "boot", "shutdown"].map(hook => [hook, () => calls.push(name + ":" + hook)])
    ]));
    const loader = loaderFor([make("auth", ["users"]), make("users", [])]);
    await loader.initialize(); await loader.boot(); await loader.shutdown();
    expect(calls).toEqual([
        "users:registerModels", "auth:registerModels", "users:associate", "auth:associate",
        "users:register", "auth:register", "users:boot", "auth:boot", "auth:shutdown", "users:shutdown"
    ]);
});
test("missing required dependency fails before any hooks", async () => {
    const module = moduleOf("auth-jwt", { dependencies: ["users"] });
    await expect(loaderFor([module]).initialize()).rejects.toThrow('Module "auth-jwt" requires module "users".');
    expect(module.register).not.toHaveBeenCalled();
});
test("circular dependencies report the chain", async () => {
    await expect(loaderFor([
        moduleOf("a", { dependencies: ["b"] }), moduleOf("b", { dependencies: ["a"] })
    ]).initialize()).rejects.toThrow("a -> b -> a");
});
test("optional dependencies may be absent and load first when present", async () => {
    const a = moduleOf("a", { optionalDependencies: ["b"] });
    const absent = loaderFor([a]);
    await absent.initialize(); await absent.shutdown();
    expect(loaderFor([a, moduleOf("b")]).resolveOrder().map(e => e.name)).toEqual(["b", "a"]);
});
test("rejects duplicate module names", () => {
    const registry = new ModuleRegistry(); registry.register(moduleOf("a"));
    expect(() => registry.register(moduleOf("a"))).toThrow("Duplicate");
});
test.each([
    {}, { name: "../bad" }, { name: "a", version: 1 }, { name: "a", version: "1.0.0" },
    { ...moduleOf("a"), name: ["a"] },
    { ...moduleOf("a"), dependencies: "b" }, { ...moduleOf("a"), boot: true },
    { ...moduleOf("a"), optionalDependencies: ["b", "b"] }, { ...moduleOf("a"), migrations: [1] }
])("rejects invalid contracts %j", value => expect(() => ModuleValidator.validate(value)).toThrow());
test("failed register cleans partially initialized modules", async () => {
    const calls = [];
    const loader = loaderFor([
        moduleOf("a", { shutdown: () => calls.push("a") }),
        moduleOf("b", { dependencies: ["a"], register: () => { throw new Error("registration failed"); }, shutdown: () => calls.push("b") })
    ]);
    await expect(loader.initialize()).rejects.toThrow("registration failed");
    expect(calls).toEqual(["b", "a"]);
});
test("boot failure cleans all registered modules and preserves original error", async () => {
    const stop = jest.fn();
    const loader = loaderFor([
        moduleOf("a", { shutdown: stop }),
        moduleOf("b", { dependencies: ["a"], boot: () => { throw new Error("boot failed"); }, shutdown: () => { throw new Error("cleanup failed"); } })
    ]);
    await loader.initialize();
    await expect(loader.boot()).rejects.toMatchObject({ message: "boot failed", cleanupError: expect.any(AggregateError) });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(loader.state).toBe("failed");
});
test("shutdown continues after failure and initialization is single use", async () => {
    const stop = jest.fn();
    const loader = loaderFor([moduleOf("a", { shutdown: stop }), moduleOf("b", { shutdown: () => { throw Error("failed"); } })]);
    await loader.initialize();
    await expect(loader.initialize()).rejects.toThrow("only initialize once");
    await expect(loader.shutdown()).rejects.toThrow(AggregateError);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(loader.registry.get("b").state).toBe("failed");
});
test("catalogs module migrations/seeders without executing them", async () => {
    const root = directory({ example: `module.exports = { name:"example", version:"1.0.0", register(){}, migrations:["migration.js"], seeders:["seed.js"] };` });
    fs.writeFileSync(path.join(root, "example/migration.js"), 'throw new Error("must not run");');
    fs.writeFileSync(path.join(root, "example/seed.js"), 'throw new Error("must not run");');
    const database = new ModuleDatabase({});
    const loader = new ModuleLoader({ directory: root, context: { database } });
    await loader.initialize();
    expect(database.list("migrations")).toHaveLength(1);
    expect(database.list("seeders")).toHaveLength(1);
    await loader.shutdown();
});
test("rejects database resource escape paths", () => {
    const database = new ModuleDatabase({});
    expect(() => database.registerResources({ name: "a", directory: directory({}), module: { migrations: ["../outside.js"] } })).toThrow("Invalid migrations");
});

 test("registers actual Sequelize models before cross-module associations", async () => {
    const { Sequelize, DataTypes } = require("sequelize");
    const sequelize = new Sequelize("test", "test", "", { dialect: "mysql", logging: false });
    const loader = loaderFor([
        moduleOf("children", { dependencies: ["parents"],
            registerModels: ({ sequelize: db }) => { db.define("Child", { label: DataTypes.STRING }); },
            associate: ({ sequelize: db }) => { db.models.Child.belongsTo(db.models.Parent); }
        }),
        moduleOf("parents", {
            registerModels: ({ sequelize: db }) => { db.define("Parent", { label: DataTypes.STRING }); },
            associate: ({ sequelize: db }) => { db.models.Parent.hasMany(db.models.Child); }
        })
    ], { sequelize });
    try {
        await loader.initialize();
        expect(Object.keys(sequelize.models)).toEqual(["Parent", "Child"]);
        expect(sequelize.models.Child.associations.Parent.target).toBe(sequelize.models.Parent);
        expect(sequelize.models.Parent.associations.Children.target).toBe(sequelize.models.Child);
    } finally { await loader.shutdown(); await sequelize.close(); }
});
