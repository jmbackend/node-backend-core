const express = require("express");
const request = require("supertest");
const { body } = require("express-validator");
const core = require("../../../src/common/public");
const EventBus = require("../../../src/common/events/EventBus");
const ModuleDatabase = require("../../../src/database/ModuleDatabase");

test("ApiResponse preserves success, error and pagination contracts", () => {
    expect(core.ApiResponse.success({ id: 1 }, "OK")).toEqual({ success: true, message: "OK", data: { id: 1 } });
    expect(core.ApiResponse.error("invalid", ["detail"])).toEqual({ success: false, message: "invalid", errors: ["detail"] });
    expect(core.ApiResponse.paginated([1], { total: 1 })).toMatchObject({ success: true, data: [1], pagination: { total: 1 } });
});
test("BaseService preserves lifecycle order", async () => {
    const order = [];
    const repository = { create: jest.fn(async data => { order.push("create"); return { id: 1, ...data }; }) };
    class Service extends core.BaseService {
        async beforeCreate() { order.push("before"); }
        async afterCreate(entity) { order.push("after:" + entity.id); }
    }
    expect(await new Service(repository).create({ name: "test" })).toEqual({ id: 1, name: "test" });
    expect(order).toEqual(["before", "create", "after:1"]);
});
test("BaseRepository pagination delegates query and retains envelope", async () => {
    const model = { findAndCountAll: jest.fn().mockResolvedValue({ rows: ["a"], count: 3 }) };
    const result = await new core.BaseRepository(model).paginate({ page: 2, limit: 2 });
    expect(model.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ offset: 2, limit: 2 }));
    expect(result).toEqual({ data: ["a"], pagination: { page: 2, limit: 2, total: 3, pages: 2 } });
});
test("BaseValidator emits a 422 with message and structured errors", async () => {
    class Validator extends core.BaseValidator { rules() { return [body("name").notEmpty()]; } }
    const app = express();
    app.use(express.json());
    app.post("/", new Validator().validate(), (req, res) => res.sendStatus(204));
    app.use(require("../../../src/middlewares/ErrorMiddleware"));
    const response = await request(app).post("/").send({}).expect(422);
    expect(response.body.message).toBe("Validation failed.");
    expect(response.body.errors[0]).toMatchObject({ path: "name" });
    await request(app).post("/").send({ name: "valid" }).expect(204);
});
test("BaseMapper and BaseDTO preserve collection behavior", () => {
    class Mapper extends core.BaseMapper { toDTO(entity) { return { id: entity.id }; } }
    expect(new Mapper().toDTOList([{ id: 1, extra: true }])).toEqual([{ id: 1 }]);
    expect(core.BaseDTO.fromArray([{ id: 1 }])[0].toJSON()).toEqual({ id: 1 });
});
test("EventBus supports sync, async, once, removal and propagated errors", async () => {
    const bus = new EventBus();
    const sync = jest.fn(); bus.on("sync", sync); bus.emit("sync", 42); bus.off("sync", sync); bus.emit("sync");
    expect(sync).toHaveBeenCalledTimes(1);
    const once = jest.fn(async () => {}); bus.once("async", once);
    await bus.emitAsync("async"); await bus.emitAsync("async");
    expect(once).toHaveBeenCalledTimes(1);
    bus.on("failure", async () => { throw new Error("consumer failed"); });
    await expect(bus.emitAsync("failure")).rejects.toThrow("consumer failed");
});
test("database transaction passes callback and options to Sequelize", async () => {
    const sequelize = { transaction: jest.fn().mockResolvedValue("done") };
    const callback = () => {};
    expect(await new ModuleDatabase(sequelize).transaction({ isolationLevel: "READ COMMITTED" }, callback)).toBe("done");
    expect(sequelize.transaction).toHaveBeenCalledWith({ isolationLevel: "READ COMMITTED" }, callback);
});
