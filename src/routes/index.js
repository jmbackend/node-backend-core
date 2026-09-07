const { Router } = require("express");
const BaseValidator = require("../common/validators/BaseValidator");
const HealthController = require("../core/health/HealthController");
module.exports = context => {
    const router = Router();
    const controller = new HealthController(context);
    router.get("/health", new BaseValidator().validate(), controller.show.bind(controller));
    return router;
};
