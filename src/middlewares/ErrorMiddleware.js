const ApiResponse = require("../common/responses/ApiResponse");
module.exports = (err, req, res, next) => {
    if (res.headersSent) return next(err);
    const supplied = err.statusCode || err.status;
    const status = Number.isInteger(supplied) && supplied >= 400 && supplied <= 599 ? supplied : 500;
    if (status >= 500) req.app.locals.context?.logger?.error("Request failed", { requestId: req.requestId });
    return res.status(status).json(ApiResponse.error(
        status >= 500 ? "Internal Server Error" : err.message || "Request failed",
        status >= 500 ? [] : err.errors || []
    ));
};
