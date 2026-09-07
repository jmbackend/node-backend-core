const express = require("express");
const request = require("supertest");
const RouteRegistry = require("../../../src/core/routes/RouteRegistry");
const RouteMiddlewareResolver = require("../../../src/core/routes/RouteMiddlewareResolver");

function setup() {
    const app = express();
    const router = express.Router();
    const routes = new RouteRegistry(router);
    const calls = [];
    routes.register({ alias: "test.list", method: "get", path: "/test", handler: (req, res) => {
        calls.push("controller");
        res.json({ ok: true });
    } });
    app.use(router);
    return { app, routes, calls };
}

test("resolves a string middleware and preserves multiple middleware order", async () => {
    const { app, routes, calls } = setup();
    const registry = { resolveMiddleware: jest.fn((alias) => (req, res, next) => { calls.push(alias); next(); }) };
    new RouteMiddlewareResolver(routes, registry, {}).apply({ "test.list": ["test.authenticate", "test.audit"] });
    await request(app).get("/test").expect(200);
    expect(calls).toEqual(["test.authenticate", "test.audit", "controller"]);
});

test("executes a middleware factory once with exact single and multiple arguments", async () => {
    const { app, routes, calls } = setup();
    const factory = jest.fn((...args) => (req, res, next) => { calls.push(args); next(); });
    const registry = { resolveMiddleware: jest.fn(() => factory) };
    new RouteMiddlewareResolver(routes, registry, {}).apply({ "test.list": [
        { middleware: "test.requireSomething", args: ["resource.read", 7] }
    ] });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith("resource.read", 7);
    await request(app).get("/test").expect(200);
    await request(app).get("/test").expect(200);
    expect(calls).toEqual([["resource.read", 7], "controller", ["resource.read", 7], "controller"]);
});

test("supports factories without args and mixed middleware while preserving order", async () => {
    const { app, routes, calls } = setup();
    const factory = jest.fn(() => (req, res, next) => { calls.push("factory"); next(); });
    const registry = { resolveMiddleware: jest.fn(alias => alias === "test.factory" ? factory : (req, res, next) => { calls.push("test.authenticate"); next(); }) };
    new RouteMiddlewareResolver(routes, registry, {}).apply({ "test.list": [
        "test.authenticate", { middleware: "test.factory" }
    ] });
    await request(app).get("/test").expect(200);
    expect(factory).toHaveBeenCalledWith();
    expect(calls).toEqual(["test.authenticate", "factory", "controller"]);
});

test.each([
    {}, { middleware: "" }, { middleware: 123 },
    { middleware: "test.factory", args: "resource.read" }
])("rejects invalid middleware configuration %j during registration", definition => {
    const { routes } = setup();
    const resolver = new RouteMiddlewareResolver(routes, { resolveMiddleware: jest.fn() }, {});
    expect(() => resolver.apply({ "test.list": [definition] })).toThrow();
});

test("rejects missing middleware and non-function factory results clearly", () => {
    const { routes } = setup();
    const resolver = new RouteMiddlewareResolver(routes, { resolveMiddleware: jest.fn(() => undefined) }, {});
    expect(() => resolver.apply({ "test.list": ["missing.middleware"] })).toThrow(/must resolve to a function/);
    const factory = jest.fn(() => "invalid");
    expect(() => new RouteMiddlewareResolver(routes, { resolveMiddleware: () => factory }, {})
        .apply({ "test.list": [{ middleware: "test.factory", args: [] }] }))
        .toThrow(/must resolve to a function/);
});

test("rejects an unknown route alias during registration", () => {
    const resolver = new RouteMiddlewareResolver(new RouteRegistry(express.Router()), {
        resolveMiddleware: () => () => {}
    }, {});
    expect(() => resolver.apply({ "missing.route": ["test.middleware"] })).toThrow(/Unknown route alias/);
});
