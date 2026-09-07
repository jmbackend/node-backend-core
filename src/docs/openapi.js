module.exports = {
    openapi: "3.0.3",
    info: { title: "Node Backend Core API", version: "1.0.0", description: "Reusable HTTP infrastructure and optional modules." },
    servers: [{ url: "/" }],
    components: {
        schemas: {
            ApiResponse: { type: "object", required: ["success", "message", "data"], properties: {
                success: { type: "boolean" }, message: { type: "string" }, data: {}
            } },
            ErrorResponse: { type: "object", required: ["success", "message", "errors"], properties: {
                success: { type: "boolean" }, message: { type: "string" }, errors: { type: "array", items: {} }
            } }
        }
    }
};
