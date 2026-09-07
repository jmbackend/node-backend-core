const BaseController = require("../../common/controllers/BaseController");
const ApiResponse = require("../../common/responses/ApiResponse");
const BaseDTO = require("../../common/dto/BaseDTO");

class HealthController extends BaseController {
    constructor({ sequelize }) { super(); this.sequelize = sequelize; }
    async show(req, res, next) {
        try {
            await this.sequelize.authenticate();
        } catch (error) {
            return res.status(503).json(ApiResponse.error("Service unavailable", [{ api: "UP", mysql: "DOWN" }]));
        }
        try {
            return this.success(res, new BaseDTO({ api: "UP", mysql: "UP", uptime: process.uptime() }), "Healthy");
        } catch (error) { return next(error); }
    }
}
module.exports = HealthController;
