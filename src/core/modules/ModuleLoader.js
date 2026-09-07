const fs = require("fs");
const path = require("path");
const ModuleRegistry = require("./ModuleRegistry");

class ModuleLoader {
    constructor({
        directory = path.join(__dirname, "../../modules"),
        packages = [],
        registry = new ModuleRegistry(),
        context = {}
    } = {}) {
        this.directory = directory;
        this.packages = packages;
        this.registry = registry;
        this.context = context;
        this.started = [];
        this.state = "new";
    }
    discover() {
        // Módulos locales: src/modules/*
        if (fs.existsSync(this.directory)) {
            for (
                const entry of fs
                    .readdirSync(this.directory, { withFileTypes: true })
                    .sort((a, b) => a.name.localeCompare(b.name))
            ) {
                if (entry.name.startsWith(".")) continue;
                if (!entry.isDirectory()) continue;

                const directory = path.resolve(this.directory, entry.name);
                const filename = path.join(directory, "index.js");

                if (!fs.existsSync(filename)) {
                    throw new Error(
                        `Module directory "${entry.name}" is missing index.js.`
                    );
                }

                this.registry.register(
                    require(filename),
                    directory
                );
            }
        }

        // Módulos externos instalados en node_modules
        for (const packageName of this.packages) {
            const filename = require.resolve(packageName);
            const directory = path.dirname(filename);

            this.registry.register(
                require(filename),
                directory
            );
        }
    }

    resolveOrder() {
        const visiting = new Set();
        const visited = new Set();
        const order = [];
        const visit = (name, chain = []) => {
            if (visiting.has(name)) throw new Error(`Circular module dependency: ${[...chain, name].join(" -> ")}`);
            if (visited.has(name)) return;
            const entry = this.registry.get(name);
            visiting.add(name);
            for (const dependency of entry.dependencies) {
                if (!this.registry.has(dependency)) throw new Error(`Module "${name}" requires module "${dependency}".`);
                visit(dependency, [...chain, name]);
            }
            for (const dependency of entry.optionalDependencies) {
                if (this.registry.has(dependency)) visit(dependency, [...chain, name]);
            }
            visiting.delete(name);
            visited.add(name);
            order.push(entry);
        };
        this.registry.list().forEach(entry => visit(entry.name));
        return order;
    }

    async initialize() {
        if (this.state !== "new") throw new Error("ModuleLoader can only initialize once.");
        this.state = "initializing";
        try {
            this.discover();
            const order = this.resolveOrder();
            for (const entry of order) {
                this.started.push(entry);
                this.registry.setState(entry.name, "registering");
                await entry.module.registerModels?.(this.context);
                this.context.database?.registerResources(entry);
            }
            for (const entry of order) await entry.module.associate?.(this.context);
            for (const entry of order) {
                await entry.module.register(this.context);
                this.registry.setState(entry.name, "registered");
            }
            this.state = "registered";
            this.context.logger?.info(`ModuleLoader registered ${order.length} module(s).`);
        } catch (error) {
            await this.cleanupAfterFailure(error);
            throw error;
        }
    }

    async boot() {
        if (this.state !== "registered") throw new Error("Modules must be registered before boot.");
        try {
            for (const entry of this.started) {
                await entry.module.boot?.(this.context);
                this.registry.setState(entry.name, "booted");
            }
            this.state = "booted";
        } catch (error) {
            await this.cleanupAfterFailure(error);
            throw error;
        }
    }

    async cleanupAfterFailure(error) {
        try { await this.shutdown(); } catch (cleanupError) { error.cleanupError = cleanupError; }
        this.state = "failed";
    }

    async shutdown() {
        const errors = [];
        for (const entry of this.started.splice(0).reverse()) {
            try {
                await entry.module.shutdown?.(this.context);
                this.registry.setState(entry.name, "stopped");
            } catch (error) {
                this.registry.setState(entry.name, "failed");
                errors.push(error);
            }
        }
        this.state = "stopped";
        if (errors.length) throw new AggregateError(errors, "Module shutdown failed.");
    }
}

module.exports = ModuleLoader;
