class RouteMiddlewareResolver {

    constructor(routeRegistry, moduleRegistry, context) {
        this.routeRegistry = routeRegistry;
        this.moduleRegistry = moduleRegistry;
        this.context = context;
    }

    apply(routes = {}) {

        for (
            const [routeAlias, middlewareAliases]
            of Object.entries(routes)
        ) {

            if (!Array.isArray(middlewareAliases)) {
                throw new Error(`Route "${routeAlias}" middleware configuration must be an array.`);
            }

            // RouteRegistry.before prepends handlers, so resolve in reverse to
            // preserve the order declared in config.routes.
            for (const definition of [...middlewareAliases].reverse()) {
                const middleware = this.resolve(definition, routeAlias);

                this.routeRegistry.before(
                    routeAlias,
                    middleware
                );

            }

        }

    }

    resolve(definition, routeAlias) {
        let alias = definition;
        let args = [];
        if (definition && typeof definition === "object") {
            alias = definition.middleware;
            args = definition.args === undefined ? [] : definition.args;
            if (typeof alias !== "string" || alias.trim() === "") {
                throw new Error(`Route "${routeAlias}" middleware must be a non-empty string.`);
            }
            if (!Array.isArray(args)) {
                throw new Error(`Route "${routeAlias}" middleware args must be an array.`);
            }
        } else if (typeof alias !== "string" || alias.trim() === "") {
            throw new Error(`Route "${routeAlias}" middleware must be a non-empty string.`);
        }

        const resolved = this.moduleRegistry.resolveMiddleware(alias, this.context);
        if (typeof resolved !== "function") {
            throw new Error(`Middleware "${alias}" for route "${routeAlias}" must resolve to a function.`);
        }
        const middleware = definition && typeof definition === "object"
            ? resolved(...args)
            : resolved;
        if (typeof middleware !== "function") {
            throw new Error(`Middleware "${alias}" for route "${routeAlias}" must resolve to a function.`);
        }
        return middleware;
    }

}

module.exports = RouteMiddlewareResolver;
