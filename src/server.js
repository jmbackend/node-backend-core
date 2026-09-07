require("dotenv").config({ quiet: true });

const createApp = require("./app");
const moduleConfig = require("./config/modules");
async function start(options = {}) {

    const sequelize = options.sequelize || require("./database");
    const logger = options.logger || require("./common/logger/Logger");
    const config = options.config || require("./config");

    let app;
    let server;

    try {

        await sequelize.authenticate();

        logger.info("MySQL connection established.");

        /*
        * Configuración final de módulos.
        *
        * moduleConfig contiene los módulos configurados por la aplicación.
        * options permite sobrescribirlos, por ejemplo durante tests.
        */
        const appOptions = {
            ...moduleConfig,
            sequelize,
            logger,
            config,
            ...options,
        };
        logger.info(
            `Loading ${appOptions.modules?.length || 0} module(s).`
        );

        app = await createApp(appOptions);

        server = await new Promise((resolve, reject) => {

            const listener = app.listen(
                config.app.port,
                () => resolve(listener)
            );

            listener.once("error", reject);

        });

        logger.info(
            config.app.name +
            " listening on port " +
            server.address().port
        );

    } catch (error) {

        try {
            await app?.locals.shutdown();
        } catch (cleanupError) {
            logger.error(cleanupError.message);
        }

        try {
            await sequelize.close();
        } catch (cleanupError) {
            logger.error(cleanupError.message);
        }

        throw error;

    }

    let stopping;

    const stop = () => {

        if (!stopping) {

            stopping = (async () => {

                const timeout = setTimeout(
                    () => server.closeAllConnections(),
                    10000
                );

                timeout.unref();

                try {

                    try {

                        await new Promise((resolve, reject) => {

                            server.close(error =>
                                error
                                    ? reject(error)
                                    : resolve()
                            );

                        });

                    } finally {

                        await app.locals.shutdown();

                    }

                } finally {

                    clearTimeout(timeout);

                    await sequelize.close();

                }

            })();

        }

        return stopping;

    };

    return {
        app,
        server,
        stop
    };

}


if (require.main === module) {

    start()
        .then(runtime => {

            const onSignal = () => {

                runtime.stop().catch(error => {

                    console.error(error.message);

                    process.exitCode = 1;

                });

            };

            process.once("SIGINT", onSignal);
            process.once("SIGTERM", onSignal);

        })
        .catch(error => {

            console.error(
                "Core startup failed: " + error.message
            );

            process.exitCode = 1;

        });

}

module.exports = start;
