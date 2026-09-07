const ModuleValidator = require("./ModuleValidator");

class ModuleRegistry {

    constructor() {
        this.entries = new Map();
    }

    register(module, directory = null) {

        ModuleValidator.validate(module);

        if (this.has(module.name)) {
            throw new Error(
                `Duplicate module "${module.name}".`
            );
        }

        this.entries.set(module.name, {
            name: module.name,
            version: module.version,
            state: "discovered",
            dependencies: [...(module.dependencies || [])],
            optionalDependencies: [...(module.optionalDependencies || [])],
            directory,
            module
        });

        return this.get(module.name);
    }

    has(name) {
        return this.entries.has(name);
    }

    get(name) {

        const entry = this.entries.get(name);

        if (!entry) {
            return undefined;
        }

        return {
            ...entry,
            dependencies: [...entry.dependencies],
            optionalDependencies: [...entry.optionalDependencies]
        };
    }

    getPublicModels(name, context) {
        const entry = this.entries.get(name);

        if (
            !entry ||
            typeof entry.module.getModels !== "function"
        ) {
            return undefined;
        }

        return entry.module.getModels(context);
    }

    list() {
        return [...this.entries.keys()]
            .map(name => this.get(name));
    }

    getPublicServices(name, context) {

        const entry = this.entries.get(name);

        if (
            !entry ||
            typeof entry.module.getServices !== "function"
        ) {
            return undefined;
        }

        const services =
            entry.module.getServices(context);

        if (
            !context?.serviceInstrumenter ||
            !services ||
            typeof services !== "object"
        ) {
            return services;
        }

        const proxiedServices = {};

        for (
            const [serviceName, service]
            of Object.entries(services)
        ) {

            if (
                service &&
                (
                    typeof service === "object" ||
                    typeof service === "function"
                )
            ) {

                proxiedServices[serviceName] =
                    context.serviceInstrumenter.instrument(
                        name,
                        service,
                        context
                    );

            } else {

                proxiedServices[serviceName] =
                    service;

            }
        }

        return Object.freeze(
            proxiedServices
        );
    }

    getPublicMiddlewares(name, context) {

        const entry = this.entries.get(name);

        const middlewares =
            entry?.module?.getMiddlewares?.(context);

        return middlewares;
    }
    resolveMiddleware(alias, context) {

        if (
            typeof alias !== "string" ||
            !alias.includes(".")
        ) {
            throw new Error(
                `Invalid middleware alias "${alias}".`
            );
        }

        const separatorIndex = alias.indexOf(".");

        const moduleName =
            alias.substring(0, separatorIndex);

        const middlewareName =
            alias.substring(separatorIndex + 1);

        const middlewares =
            this.getPublicMiddlewares(
                moduleName,
                context
            );

        if (!middlewares) {
            throw new Error(
                `Module "${moduleName}" does not expose middlewares.`
            );
        }

        const middleware =
            middlewares[middlewareName];

        if (typeof middleware !== "function") {
            throw new Error(
                `Unknown middleware "${alias}".`
            );
        }

        return middleware;
    }

    setState(name, state) {

        const entry = this.entries.get(name);

        if (!entry) {
            throw new Error(
                `Unknown module "${name}".`
            );
        }

        entry.state = state;
    }

}

module.exports = ModuleRegistry;
