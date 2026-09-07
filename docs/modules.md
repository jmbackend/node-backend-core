# Module system V1

Install a module by adding src/modules/<directory>/index.js and installing its npm
dependencies/configuration. The Core ships no feature modules or installer CLI.
Discovery uses direct child directories, ignores hidden entries and rejects
directories missing index.js. An absent or empty module directory is valid.

## Contract

```js
module.exports = {
    name: "example",
    version: "1.0.0",
    dependencies: [],
    optionalDependencies: [],
    registerModels(context) {
        // Define models using context.sequelize; no associations yet.
    },
    associate(context) {
        // All modules have defined their models at this point.
    },
    async register(context) {
        // context.router.use("/example", routes);
    },
    async boot(context) {
        // Start resources after all register hooks finish.
    },
    async shutdown(context) {
        // Release resources, including partially initialized resources.
    },
    migrations: [],
    seeders: []
};
```

name, version and register are required. Names are lowercase letters, digits and
hyphens, starting with a letter. Other lifecycle hooks are optional.
Dependencies are module names, not npm version ranges. Required dependencies must
exist; installed optional dependencies load first as well. Missing optional
dependencies are ignored. Cycles (including installed optional dependencies) and
duplicate names fail explicitly before lifecycle hooks run.

Initialization order is: discovery/validation -> dependency ordering -> all model
hooks -> all association hooks -> all register hooks -> all boot hooks.
Modules must define models only in registerModels, not register.
Shutdown runs in reverse dependency order and continues after individual failures,
then reports an AggregateError. Startup failures also trigger cleanup. Hooks must
return/await their work and shutdown must tolerate partially initialized state.
A loader cannot be restarted; create a fresh application after a startup failure.

## Context and registry

context provides app, router, sequelize, logger, config, eventBus, hooks,
serviceInstrumenter, database and core. See [service instrumentation and hooks](hooks.md)
for controller composition and application-owned events.
context.core exposes the existing Base classes, ApiResponse, exceptions and
requestContext (AsyncLocalStorage). requestContext.getStore()?.requestId is scoped
to the current request. The context object is frozen; infrastructure services are
deliberately usable objects, not a security sandbox.

Use context.router for feature routes, mounted at /api/v1. context.app is reserved
for integrations that explicitly need application-level middleware.
Register routes during register, not boot or background callbacks.

app.locals.moduleRegistry exposes get(name), has(name), list(), including
name/version/state/dependencies. States are discovered, registering, registered,
booted, stopped and failed. Module source is trusted local executable code.

## Events and dependencies

Use context.eventBus.on/off/once and emit for synchronous Node EventEmitter
semantics. Use await emitAsync(name, payload) to await asynchronous consumers and
propagate failures. Events are in-process and not durable; no queue or retry policy
is implied. Modules remove their listeners during shutdown; Core clears the bus
when the application shuts down.

The Core creates one EventBus per application and injects that same instance into
every module context. A module can publish without importing another module:

```js
await eventBus.emitAsync("users.created", {
    userId: user.id,
    email: user.email,
    name: user.name
});
```

Listeners should be retained and removed during shutdown:

```js
const handler = event => notificationService.send({
    type: "EMAIL", recipient: event.email, template: "WELCOME"
});
async register({ eventBus }) { eventBus.on("users.created", handler); }
async shutdown({ eventBus }) { eventBus.off("users.created", handler); }
```

Use `<module>.<action>` event names, keep payloads minimal, and never include
passwords, tokens, or secrets. `emitAsync` remains in-process; it is not a queue.

Do not import another module's internals. Communicate using events or explicit
public contracts. A future authentication module may depend on users; users must
not depend on a concrete authentication provider.

## Database resources

context.sequelize provides model registration and connection APIs.
context.database.transaction delegates to Sequelize transactions. Associations
should only reference models from declared dependencies or available optional ones.

migrations/seeders arrays contain relative file paths within the module directory.
The Core validates and catalogs these paths. context.database.list("migrations")
or list("seeders") returns module, kind and absolute filename entries in load order.
V1 does not execute these files or implement migration tracking; applications must
run them explicitly with their chosen migration tool. Core has no schema migrations.

## Swagger

Add JSDoc OpenAPI files under the module's swagger/ directory. The Core collects
documentation only from discovered, registered modules. Define module components
in those files, using unique names. Document the full public path
(e.g. /api/v1/example); the OpenAPI server URL is /. Generic ApiResponse and
ErrorResponse schemas are available. Auth schemes belong to the auth provider's
documentation, not the Core.
