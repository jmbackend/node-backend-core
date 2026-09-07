const EventBus = require("../../../src/common/events/EventBus");

describe("EventBus", () => {
    test("emits synchronously and counts listeners", () => {
        const bus = new EventBus();
        const listener = jest.fn();
        const payload = { id: 1 };
        bus.on("test.event", listener);
        bus.emit("test.event", payload);
        expect(listener).toHaveBeenCalledWith(payload);
        expect(bus.listenerCount("test.event")).toBe(1);
    });

    test("waits for async listeners", async () => {
        const bus = new EventBus();
        let completed = false;
        bus.on("test.event", async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            completed = true;
        });
        await bus.emitAsync("test.event", {});
        expect(completed).toBe(true);
    });

    test("runs all listeners and propagates errors", async () => {
        const bus = new EventBus();
        const first = jest.fn();
        const second = jest.fn(async () => { throw new Error("listener failed"); });
        const third = jest.fn();
        bus.on("test.event", first);
        bus.on("test.event", second);
        bus.on("test.event", third);
        await expect(bus.emitAsync("test.event", {})).rejects.toThrow("listener failed");
        expect(first).toHaveBeenCalled();
        expect(third).toHaveBeenCalled();
    });

    test("supports once and off", async () => {
        const bus = new EventBus();
        const once = jest.fn();
        const removable = jest.fn();
        bus.once("test.event", once);
        bus.on("test.event", removable);
        bus.off("test.event", removable);
        await bus.emitAsync("test.event", {});
        await bus.emitAsync("test.event", {});
        expect(once).toHaveBeenCalledTimes(1);
        expect(removable).not.toHaveBeenCalled();
    });
});
