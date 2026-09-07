const HttpStatus =
    require("../http/HttpStatus");

const HttpMessages =
    require("../http/HttpMessages");

class ForbiddenError extends Error {

    constructor(message = HttpMessages.FORBIDDEN) {

        super(message);

        this.name = "ForbiddenError";

        this.statusCode =
            HttpStatus.FORBIDDEN;

    }

}

module.exports = ForbiddenError;