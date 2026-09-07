const { randomUUID } = require("crypto");
const requestContext = require("../common/context/RequestContext");

module.exports = (req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    requestContext.run({ requestId: req.requestId }, next);
};
