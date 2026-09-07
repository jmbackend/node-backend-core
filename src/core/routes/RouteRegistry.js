class RouteRegistry {
    constructor(router) {
        this.router = router;
        this.routes = new Map();
    }

    register({ alias, method, path, handlers = [], handler }) {
        if (!alias || this.routes.has(alias)) throw new Error(`Duplicate route alias "${alias}".`);
        const definition = { alias, method: method.toLowerCase(), path, handlers: [...handlers], handler };
        this.routes.set(alias, definition);
        this.router[definition.method](path, (req, res, next) => {
            const chain = [...definition.handlers, handler];
            let index = 0;
            const run = error => {
                if (error) return next(error);
                const current = chain[index++];
                if (!current) return next();
                return current(req, res, run);
            };
            return run();
        });
        return definition;
    }

    get(alias) { return this.routes.get(alias); }

    before(alias, middleware) {
        const route = this.routes.get(alias);
        if (!route) throw new Error(`Unknown route alias "${alias}".`);
        route.handlers.unshift(middleware);
        return route;
    }
}

module.exports = RouteRegistry;
