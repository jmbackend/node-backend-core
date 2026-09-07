const ServiceInstrumenter = require("../../../src/core/services/ServiceInstrumenter");
const HookRegistry = require("../../../src/common/hooks/HookRegistry");
const ModuleRegistry = require("../../../src/core/modules/ModuleRegistry");

function setup() {
    const logger = { error: jest.fn() };
    const context = { hooks: new HookRegistry({ logger }), serviceInstrumenter: new ServiceInstrumenter(), logger };
    return context;
}

test("no hooks leaves the original unchanged; cache is scoped to module and context", () => {
    const context = setup();
    const instrumenter = context.serviceInstrumenter;
    const original = { read() { return 42; } };
    expect(instrumenter.instrument("test", original, {})).toBe(original);
    const proxy = instrumenter.instrument("test", original, context);
    expect(proxy).not.toBe(original);
    expect(instrumenter.instrument("test", original, context)).toBe(proxy);
    expect(instrumenter.instrument("test", proxy, context)).toBe(proxy);
    expect(instrumenter.instrument("other", original, context)).not.toBe(proxy);
    expect(instrumenter.instrument("test", original, setup())).not.toBe(proxy);
});

test("frozen services retain getters, inheritance, private state and original this", async () => {
    const context = setup();
    class Parent { inherited() { return this.value; } }
    class Service extends Parent {
        #value = 7;
        get value() { return this.#value; }
        read() { return this.inherited(); }
    }
    const service = Object.freeze(new Service());
    const proxy = context.serviceInstrumenter.instrument("test", service, context);
    const calls = [];
    context.hooks.before("test", "read", async () => {
        await Promise.resolve(); calls.push("before");
    });
    context.hooks.after("test", "read", ({ result }) => { calls.push(result); return 999; });
    const internal = jest.fn();
    context.hooks.before("test", "inherited", internal);
    expect(proxy.constructor).toBe(Service);
    expect(proxy.value).toBe(7);
    expect(await proxy.read()).toBe(7);
    expect(calls).toEqual(["before", 7]);
    expect(internal).not.toHaveBeenCalled();
    const frozen = Object.freeze({ read: () => 42 });
    await expect(context.serviceInstrumenter.instrument("test", frozen, context).read()).resolves.toBe(42);
});

test("ordered hooks preserve operation errors even if error hooks or logging fail", async () => {
    const context = setup();
    const calls = [];
    const originalError = new Error("operation failed");
    context.hooks.before("test", "run", () => calls.push("before"));
    context.hooks.error("test", "run", () => { calls.push("error1"); throw Error("hook failed"); });
    context.hooks.error("test", "run", ({ error }) => { expect(error).toBe(originalError); calls.push("error2"); });
    context.logger.error.mockImplementation(() => { throw Error("logger failed"); });
    const service = context.serviceInstrumenter.instrument("test", {
        run() { calls.push("service"); throw originalError; }
    }, context);
    await expect(service.run()).rejects.toBe(originalError);
    expect(calls).toEqual(["before", "service", "error1", "error2"]);
    expect(context.logger.error).toHaveBeenCalledTimes(1);
});

test("before prevents operation; after failures propagate without invoking operation error hooks", async () => {
    const context = setup();
    const run = jest.fn(() => 1);
    const errorHook = jest.fn();
    const failure = Error("hook failed");
    context.hooks.error("test", "run", errorHook);
    context.hooks.before("test", "run", () => { throw failure; });
    const service = context.serviceInstrumenter.instrument("test", { run }, context);
    await expect(service.run()).rejects.toBe(failure);
    expect(run).not.toHaveBeenCalled();
    context.hooks.clear("test", "run");
    context.hooks.error("test", "run", errorHook);
    context.hooks.after("test", "run", () => { throw failure; });
    await expect(service.run()).rejects.toBe(failure);
    expect(run).toHaveBeenCalledTimes(1);
    expect(errorHook).not.toHaveBeenCalled();
});

test("registry supports frozen containers, stable services, late hooks and already instrumented services", async () => {
    const context = setup();
    const registry = new ModuleRegistry();
    const original = Object.freeze({ run: jest.fn(async () => 10) });
    const proxy = context.serviceInstrumenter.instrument("test", original, context);
    registry.register({ name: "test", version: "1.0.0", register() {},
        getServices: () => Object.freeze({ original, proxy, metadata: "v1" }) });
    const services = registry.getPublicServices("test", context);
    expect(services.original).toBe(proxy);
    expect(services.proxy).toBe(proxy);
    expect(registry.getPublicServices("test", context).original).toBe(proxy);
    expect(services.metadata).toBe("v1");
    const handler = jest.fn();
    context.hooks.after("test", "run", handler);
    await expect(services.proxy.run()).resolves.toBe(10);
    expect(handler).toHaveBeenCalledTimes(1);
    context.hooks.remove("after", "test", "run", handler);
    await services.original.run();
    expect(handler).toHaveBeenCalledTimes(1);
});
