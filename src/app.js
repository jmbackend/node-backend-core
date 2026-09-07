const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const swaggerUi = require("swagger-ui-express");
const ModuleLoader = require("./core/modules/ModuleLoader");
const ModuleDatabase = require("./database/ModuleDatabase");
const EventBus = require("./common/events/EventBus");
const HookRegistry = require("./common/hooks/HookRegistry");
const ServiceInstrumenter = require("./core/services/ServiceInstrumenter");
const RouteRegistry = require("./core/routes/RouteRegistry");
const RouteMiddlewareResolver =
    require("./core/routes/RouteMiddlewareResolver");

async function createApp(options = {}) {
    const app = express();
    const router = express.Router();
    const sequelize = options.sequelize || require("./database");
    const logger = options.logger || require("./common/logger/Logger");
    const config = options.config || require("./config");
    const eventBus = new EventBus();
    const hooks = new HookRegistry({ logger });
    const serviceInstrumenter = new ServiceInstrumenter();
    const database = new ModuleDatabase(sequelize);
    const routeRegistry = new RouteRegistry(router);
    const context = Object.freeze({ app, router, routeRegistry, sequelize, logger, eventBus, hooks, serviceInstrumenter, config, database, core: require("./common/public") });
    const loader = new ModuleLoader({
        directory: options.modulesDirectory,
        packages: options.modules || [],
        context
    });
    app.locals.moduleRegistry = loader.registry;
    routeRegistry.moduleRegistry = loader.registry;
    app.locals.moduleLoader = loader;
    app.locals.context = context;
    app.use(helmet(), cors(), compression());
    app.use(require("./middlewares/RequestContextMiddleware"));
    app.use((req, res, next) => {
        logger.info(req.method + " " + req.path, { requestId: req.requestId });
        next();
    });

    for (const rawBodyPath of options.rawBodyPaths || []) {
        app.use(
            rawBodyPath,
            express.raw({ type: "application/json" })
        );
    }

    app.use(express.json(), express.urlencoded({ extended: true }));
    let cleanupIntegrations;
    const cleanup = async () => {
        const callback = cleanupIntegrations;
        cleanupIntegrations = undefined;
        try { await callback?.(); } finally { eventBus.removeAllListeners(); }
    };
    try {
        app.use(require("./routes")(context));
        if (typeof options.registerHooks === "function") cleanupIntegrations = await options.registerHooks(context);
        await loader.initialize();
        const middlewareResolver =
            new RouteMiddlewareResolver(
                routeRegistry,
                loader.registry,
                context
            );

        middlewareResolver.apply(
            options.routes
        );

        const spec = require("./config/swagger")(loader.registry);
        app.get("/api/docs.json", (req, res) => res.json(spec));
        app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec));
        app.use("/api/v1", router);
        app.use(require("./middlewares/NotFoundMiddleware"));
        app.use(require("./middlewares/ErrorMiddleware"));
        await loader.boot();
    } catch (error) {
        try { await loader.shutdown(); } catch (cleanupError) { error.cleanupError = cleanupError; }
        try { await cleanup(); } catch (cleanupError) { error.integrationCleanupError = cleanupError; }
        throw error;
    }
    app.locals.shutdown = async () => {
        try { await loader.shutdown(); } finally { await cleanup(); }
    };
    return app;
}
module.exports = createApp;
