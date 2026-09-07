const HttpStatus =
    require("../http/HttpStatus");

const HttpMessages =
    require("../http/HttpMessages");

class BadRequestError extends Error {

    constructor(message = HttpMessages.BAD_REQUEST) {

        super(message);

        this.name = "BadRequestError";

        this.statusCode =
            HttpStatus.BAD_REQUEST;

    }

}

module.exports = BadRequestError;