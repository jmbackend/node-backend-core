const HttpStatus =
    require("../http/HttpStatus");

const HttpMessages =
    require("../http/HttpMessages");

class InternalServerError extends Error {

    constructor(message = HttpMessages.INTERNAL_SERVER_ERROR) {

        super(message);

        this.name = "InternalServerError";

        this.statusCode =
            HttpStatus.INTERNAL_SERVER_ERROR;

    }

}

module.exports = InternalServerError;