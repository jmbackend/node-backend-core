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

            for (const middlewareAlias of middlewareAliases) {

                const middleware =
                    this.moduleRegistry.resolveMiddleware(
                        middlewareAlias,
                        this.context
                    );

                this.routeRegistry.before(
                    routeAlias,
                    middleware
                );

            }

        }

    }

}

module.exports = RouteMiddlewareResolver;