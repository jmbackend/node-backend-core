# Hooks and service instrumentation

The Core creates one `HookRegistry` and one `ServiceInstrumenter` per application.
Modules receive both through `context` and may instrument their public services
without importing another module's internals.

## Hook lifecycle

Register handlers with `before`, `after` and `error` hooks:

```js
hooks.before("catalog", "list", async ({ args, context }) => {});
hooks.after("catalog", "list", async ({ result, context }) => {});
hooks.error("catalog", "list", async ({ error, context }) => {});
```

`before` runs before the service method, `after` runs after a successful result,
and `error` runs when the method fails. Handlers run in registration order and
are awaited sequentially. Hook payloads are references; handlers should not
mutate business data or log credentials, tokens, passwords or complete payloads.

Remove handlers during module shutdown:

```js
hooks.remove("after", "catalog", "list", handler);
hooks.clear("catalog", "list");
```

`HookRegistry` uses exact module and method names. It does not implement
wildcards or priorities. A failing error hook is logged while the original
operation error is preserved.

## ServiceInstrumenter

Modules can wrap a service before giving it to a controller or exposing it from
their public API:

```js
const instrumented = context.serviceInstrumenter.instrument(
    "catalog",
    service,
    context
);
```

Instrumentation is cached per service and application context. Reusing the same
service returns the same proxy, while separate applications remain isolated.
The proxy preserves method binding and supports frozen service objects through an
intermediary target. Internal calls made through the original service are not
intercepted.

Application code chooses which hooks and events to register. The Core provides
the registry and proxy infrastructure but does not register business integrations
automatically.
