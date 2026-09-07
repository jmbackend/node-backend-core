const fs = require("fs");
const path = require("path");
const request = require("supertest");
const createApp = require("../../../src/app");
const start = require("../../../src/server");
const { fixture, logger } = require("../../helpers/modules");
let f, app, db;
beforeEach(() => {
    f = fixture({});
    db = { authenticate: jest.fn().mockResolvedValue(undefined), close: jest.fn().mockResolvedValue(undefined) };
});
afterEach(async () => { await app?.locals.shutdown(); app = null; f.cleanup(); });
async function build() { app = await createApp({ sequelize: db, logger: logger(), modulesDirectory: f.root }); return app; }

test("empty Core returns DB health with standard envelope and request ID", async () => {
    const response = await request(await build()).get("/health").expect(200);
    expect(response.body).toMatchObject({ success: true, message: "Healthy", data: { api: "UP", mysql: "UP" } });
    expect(response.headers["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
    expect(db.authenticate).toHaveBeenCalledTimes(1);
    expect(app.locals.moduleRegistry.list()).toEqual([]);
});
test("health degrades without leaking DB errors", async () => {
    db.authenticate.mockRejectedValue(new Error("private database detail"));
    const response = await request(await build()).get("/health").expect(503);
    expect(response.body).toEqual({ success: false, message: "Service unavailable", errors: [{ api: "UP", mysql: "DOWN" }] });
});
test("missing business routes and unknown endpoints return standard 404", async () => {
    await build();
    for (const url of ["/api/v1/users", "/api/v1/auth/login", "/missing"]) {
        const response = await request(app).get(url).expect(404);
        expect(response.body).toEqual({ success: false, message: "Route not found", errors: [] });
    }
});
test("malformed JSON uses error middleware", async () => {
    const response = await request(await build()).post("/missing").set("Content-Type", "application/json").send("{").expect(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors).toEqual([]);
});
test("discovers routes and documentation without manual registration", async () => {
    const directory = path.join(f.root, "example");
    fs.mkdirSync(path.join(directory, "swagger"), { recursive: true });
    fs.writeFileSync(path.join(directory, "index.js"), `module.exports = {
        name:"example",version:"1.0.0",
        register({router,core}) {
            router.get("/example", (req,res) => res.json(core.ApiResponse.success({requestId:core.requestContext.getStore().requestId})));
            router.get("/failure", () => {throw new Error("private detail");});
            router.get("/validation", () => {throw new core.exceptions.ValidationError([{field:"name"}], "Invalid name");});
        }
    };`);
    fs.writeFileSync(path.join(directory, "swagger/example.js"), `/**
 * @openapi
 * /api/v1/example:
 *   get:
 *     responses:
 *       '200':
 *         description: Example response.
 */`);
    await build();
    const response = await request(app).get("/api/v1/example").expect(200);
    expect(response.body.data.requestId).toBe(response.headers["x-request-id"]);
    const failure = await request(app).get("/api/v1/failure").expect(500);
    expect(failure.body).toEqual({ success: false, message: "Internal Server Error", errors: [] });
    const validation = await request(app).get("/api/v1/validation").expect(422);
    expect(validation.body).toMatchObject({ message: "Invalid name", errors: [{ field: "name" }] });
    const spec = await request(app).get("/api/docs.json").expect(200);
    expect(spec.body.paths).toHaveProperty("/api/v1/example");
});
test("Core Swagger documents only health without auth schemes", async () => {
    const response = await request(await build()).get("/api/docs.json").expect(200);
    expect(Object.keys(response.body.paths)).toEqual(["/health"]);
    expect(response.body.components.securitySchemes).toBeUndefined();
    await request(app).get("/api/docs/").expect(200);
});
test("server authenticates before listening and closes DB exactly once", async () => {
    const runtime = await start({ sequelize: db, logger: logger(), modules: [], modulesDirectory: f.root, config: { app: { port: 0, name: "test" } } });
    try { await request(runtime.server).get("/health").expect(200); }
    finally { await runtime.stop(); await runtime.stop(); }
    expect(db.close).toHaveBeenCalledTimes(1);
});
test("server fails without opening HTTP when MySQL is unavailable", async () => {
    db.authenticate.mockRejectedValue(new Error("DB unavailable"));
    await expect(start({ sequelize: db, logger: logger(), modulesDirectory: f.root })).rejects.toThrow("DB unavailable");
    expect(db.close).toHaveBeenCalledTimes(1);
});
test("request context remains isolated across concurrent async handlers", async () => {
    const directory = path.join(f.root, "context");
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "index.js"), `module.exports={name:"context",version:"1.0.0",register({router,core}){
        router.get("/context",async (req,res)=>{await new Promise(r=>setTimeout(r,10));res.json({id:core.requestContext.getStore().requestId});});
    }};`);
    await build();
    const results = await Promise.all(Array.from({ length: 5 }, () => request(app).get("/api/v1/context")));
    expect(new Set(results.map(r => r.body.id)).size).toBe(5);
    results.forEach(r => expect(r.body.id).toBe(r.headers["x-request-id"]));
});
