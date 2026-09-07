class ServiceInstrumenter {
    constructor() {
        this.contexts = new WeakMap();
    }

    instrument(moduleName, service, context) {
        if (!context?.hooks || !service ||
            !["object", "function"].includes(typeof service)) return service;

        let modules = this.contexts.get(context);
        if (!modules) this.contexts.set(context, modules = new Map());
        let services = modules.get(moduleName);
        if (!services) modules.set(moduleName, services = new WeakMap());
        if (services.has(service)) return services.get(service);

        const instrumented = context.hooks.proxy(moduleName, service, context);
        services.set(service, instrumented);
        services.set(instrumented, instrumented);
        return instrumented;
    }
}

module.exports = ServiceInstrumenter;
