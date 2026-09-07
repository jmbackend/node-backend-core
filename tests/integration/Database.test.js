const { Sequelize } = require("sequelize");
const request = require("supertest");
const createApp = require("../../src/app");
const { fixture, logger } = require("../helpers/modules");

const integration = process.env.TEST_DB_HOST ? describe : describe.skip;
integration("real MySQL Core", () => {
    let sequelize, app, f;
    beforeAll(async () => {
        sequelize = new Sequelize(process.env.TEST_DB_NAME, process.env.TEST_DB_USER, process.env.TEST_DB_PASSWORD, {
            dialect: "mysql", host: process.env.TEST_DB_HOST, port: Number(process.env.TEST_DB_PORT || 3306),
            logging: false, dialectOptions: { connectTimeout: 5000 }
        });
        f = fixture({});
        await sequelize.authenticate();
        app = await createApp({ sequelize, logger: logger(), modulesDirectory: f.root });
    });
    afterAll(async () => {
        await app?.locals.shutdown();
        await sequelize?.close();
        f?.cleanup();
    });
    test("connects and executes a real query without business models", async () => {
        const [rows] = await sequelize.query("SELECT 1 AS healthy");
        expect(rows[0].healthy).toBe(1);
        expect(Object.keys(sequelize.models)).toEqual([]);
    });
    test("health confirms the real MySQL connection", async () => {
        const response = await request(app).get("/health").expect(200);
        expect(response.body.data.mysql).toBe("UP");
    });
});
