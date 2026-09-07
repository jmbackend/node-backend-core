class HookRegistry {

    constructor({ logger } = {}) {
        this.logger = logger;
        this.hooks = new Map();
    }

    _key(type, module, method) {
        return `${type}:${module}:${method}`;
    }

    _add(type, module, method, handler) {

        if (typeof handler !== "function") {
            throw new TypeError(
                "Hook handler must be a function."
            );
        }

        const key =
            this._key(
                type,
                module,
                method
            );

        if (!this.hooks.has(key)) {
            this.hooks.set(key, []);
        }

        this.hooks
            .get(key)
            .push(handler);

        return handler;
    }

    before(module, method, handler) {
        return this._add(
            "before",
            module,
            method,
            handler
        );
    }

    after(module, method, handler) {
        return this._add(
            "after",
            module,
            method,
            handler
        );
    }

    error(module, method, handler) {
        return this._add(
            "error",
            module,
            method,
            handler
        );
    }

    remove(
        type,
        module,
        method,
        handler
    ) {

        const key =
            this._key(
                type,
                module,
                method
            );

        const current =
            this.hooks.get(key) || [];

        const remaining =
            current.filter(
                item =>
                    item !== handler
            );

        if (remaining.length) {

            this.hooks.set(
                key,
                remaining
            );

        } else {

            this.hooks.delete(key);

        }
    }

    clear(module, method) {

        for (
            const type of [
                "before",
                "after",
                "error"
            ]
        ) {

            this.hooks.delete(
                this._key(
                    type,
                    module,
                    method
                )
            );
        }
    }

    count(type, module, method) {

        return (
            this.hooks.get(
                this._key(
                    type,
                    module,
                    method
                )
            ) || []
        ).length;
    }

    _list(type, module, method) {

        return [
            ...(
                this.hooks.get(
                    this._key(
                        type,
                        module,
                        method
                    )
                ) || []
            )
        ];
    }

    async execute(
        type,
        module,
        method,
        details
    ) {

        for (
            const handler of
            this._list(
                type,
                module,
                method
            )
        ) {

            await handler({
                module,
                method,
                ...details
            });
        }
    }

    proxy(module, service, context) {

        if (
            !service ||
            (
                typeof service !== "object" &&
                typeof service !== "function"
            )
        ) {
            return service;
        }

        /*
         * Target intermediario para evitar violar
         * invariantes de Proxy cuando el servicio
         * original está congelado.
         */
        const target =
            Object.create(service);

        return new Proxy(target, {

            get: (_, property) => {

                const value =
                    service[property];

                if (
                    typeof value !== "function" ||
                    typeof property !== "string" ||
                    property === "constructor"
                ) {
                    return value;
                }

                return async (...args) => {

                    const details = {
                        args,
                        context
                    };

                    await this.execute(
                        "before",
                        module,
                        property,
                        details
                    );

                    let result;
                    try {

                        result =
                            await value.apply(
                                service,
                                args
                            );

                    } catch (error) {

                        if (
                            this.count(
                                "error",
                                module,
                                property
                            )
                        ) {

                            for (const handler of this._list("error", module, property)) {
                                try {
                                    await handler({ module, method: property, ...details, error });
                                } catch (hookError) {
                                    // Neither a hook nor a broken logger may mask the operation error.
                                    try {
                                        this.logger?.error("Hook handler failed", {
                                            module, method: property, error: hookError
                                        });
                                    } catch { /* Preserve original error. */ }
                                }
                            }
                        }

                        throw error;
                    }
                    await this.execute("after", module, property, { ...details, result });
                    return result;
                };
            }
        });
    }
}

module.exports =
    HookRegistry;
