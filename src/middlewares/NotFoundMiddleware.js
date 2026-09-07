const ApiResponse = require("../common/responses/ApiResponse");
module.exports = (req, res) => res.status(404).json(ApiResponse.error("Route not found"));
