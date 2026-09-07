const path = require("path");
const swaggerJSDoc = require("swagger-jsdoc");

module.exports = registry => {
    const entries = registry.list();


    const apis = [
        path.join(__dirname, "../docs/**/*.js"),
        ...entries
            .filter(entry => entry.directory)
            .map(entry => path.join(entry.directory, "swagger/**/*.js"))
    ].map(filename => filename.replace(/\\/g, "/"));

    return swaggerJSDoc({
        failOnErrors: true,
        definition: require("../docs/openapi"),
        apis
    });
};
