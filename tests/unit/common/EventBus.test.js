const EventBus = require("../../../src/common/events/EventBus");

describe("EventBus", () => {
    test("registers and emits a payload exactly once", () => {
        const bus = new EventBus();
        const listener = jest.fn();
        const payload = { id: 123 };
        bus.on("test.created", listener);
        bus.emit("test.created", payload);
        expect(listener).toHaveBeenCalledWith(payload);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test("invokes multiple listeners for the same event", () => {
        const bus = new EventBus();
        const first = jest.fn();
        const second = jest.fn();
        bus.on("test.created", first);
        bus.on("test.created", second);
        bus.emit("test.created", { id: 123 });
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

    test("keeps different event names independent", () => {
        const bus = new EventBus();
        const created = jest.fn();
        const updated = jest.fn();
        bus.on("test.created", created);
        bus.on("test.updated", updated);
        bus.emit("test.created", { id: 123 });
        expect(created).toHaveBeenCalledTimes(1);
        expect(updated).not.toHaveBeenCalled();
    });

    test("off removes only the selected listener", async () => {
        const bus = new EventBus();
        const removed = jest.fn();
        const retained = jest.fn();
        bus.on("test.created", removed);
        bus.on("test.created", retained);
        bus.off("test.created", removed);
        await bus.emitAsync("test.created", { id: 123 });
        expect(removed).not.toHaveBeenCalled();
        expect(retained).toHaveBeenCalledTimes(1);
    });

    test("preserves the payload passed to listeners", () => {
        const bus = new EventBus();
        const listener = jest.fn();
        const payload = { id: 123, name: "Example" };
        bus.on("test.created", listener);
        bus.emit("test.created", payload);
        expect(listener).toHaveBeenCalledWith(payload);
        expect(payload).toEqual({ id: 123, name: "Example" });
    });

    test("waits for async listeners with emitAsync", async () => {
        const bus = new EventBus();
        let completed = false;
        bus.on("test.created", async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            completed = true;
        });
        await bus.emitAsync("test.created", {});
        expect(completed).toBe(true);
    });

    test("runs all async listeners and propagates listener errors", async () => {
        const bus = new EventBus();
        const first = jest.fn();
        const failing = jest.fn(async () => { throw new Error("listener failure"); });
        const third = jest.fn();
        bus.on("test.created", first);
        bus.on("test.created", failing);
        bus.on("test.created", third);
        await expect(bus.emitAsync("test.created", {})).rejects.toThrow("listener failure");
        expect(first).toHaveBeenCalledTimes(1);
        expect(third).toHaveBeenCalledTimes(1);
    });

    test("propagates synchronous listener errors from emit", () => {
        const bus = new EventBus();
        bus.on("test.created", () => { throw new Error("listener failure"); });
        expect(() => bus.emit("test.created", {})).toThrow("listener failure");
    });

    test("supports once and listener cleanup", async () => {
        const bus = new EventBus();
        const once = jest.fn();
        bus.once("test.created", once);
        await bus.emitAsync("test.created", {});
        await bus.emitAsync("test.created", {});
        expect(once).toHaveBeenCalledTimes(1);
        expect(bus.listenerCount("test.created")).toBe(0);
        const retained = jest.fn();
        bus.on("test.updated", retained);
        bus.removeAllListeners("test.updated");
        await bus.emitAsync("test.updated", {});
        expect(retained).not.toHaveBeenCalled();
    });
});
