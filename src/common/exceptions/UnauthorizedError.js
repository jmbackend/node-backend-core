const HttpStatus =
    require("../http/HttpStatus");

const HttpMessages =
    require("../http/HttpMessages");

class UnauthorizedError extends Error {

    constructor(message = HttpMessages.UNAUTHORIZED) {

        super(message);

        this.name = "UnauthorizedError";

        this.statusCode =
            HttpStatus.UNAUTHORIZED;

    }

}

module.exports = UnauthorizedError;