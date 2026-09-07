const HookRegistry = require("../../../src/common/hooks/HookRegistry");

test("executes before, service and after in order", async () => {
    const hooks = new HookRegistry();
    const calls = [];
    hooks.before("test", "create", async ({ args }) => { calls.push(["before", args[0].name]); });
    hooks.after("test", "create", async ({ result }) => { calls.push(["after", result.id]); });
    const service = hooks.proxy("test", {
        async create(data) { calls.push(["service", data.name]); return { id: 1, ...data }; }
    }, { hooks });
    await expect(service.create({ name: "Juan" })).resolves.toEqual({ id: 1, name: "Juan" });
    expect(calls).toEqual([["before", "Juan"], ["service", "Juan"], ["after", 1]]);
});

test("runs error hooks and preserves the original error", async () => {
    const hooks = new HookRegistry();
    const errorHook = jest.fn();
    hooks.error("test", "fail", errorHook);
    const original = new Error("original");
    const service = hooks.proxy("test", { fail() { throw original; } }, {});
    await expect(service.fail()).rejects.toBe(original);
    expect(errorHook).toHaveBeenCalledWith(expect.objectContaining({ error: original, module: "test", method: "fail" }));
});

test("supports remove, clear and count", () => {
    const hooks = new HookRegistry();
    const handler = () => {};
    hooks.after("test", "create", handler);
    expect(hooks.count("after", "test", "create")).toBe(1);
    hooks.remove("after", "test", "create", handler);
    expect(hooks.count("after", "test", "create")).toBe(0);
    hooks.before("test", "create", handler);
    hooks.error("test", "create", handler);
    hooks.clear("test", "create");
    expect(hooks.count("before", "test", "create")).toBe(0);
    expect(hooks.count("error", "test", "create")).toBe(0);
});
