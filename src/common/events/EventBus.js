const { EventEmitter } = require("events");

class EventBus extends EventEmitter {
    // emit follows Node's synchronous contract. Await async consumers explicitly.
    async emitAsync(name, ...args) {
        await Promise.all(this.rawListeners(name).map(listener => Promise.resolve().then(() => listener.apply(this, args))));
    }
}

module.exports = EventBus;
