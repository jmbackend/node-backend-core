const HttpStatus =
    require("../http/HttpStatus");

const HttpMessages =
    require("../http/HttpMessages");

class NotFoundError extends Error {

    constructor(message = HttpMessages.NOT_FOUND) {

        super(message);

        this.name = "NotFoundError";

        this.statusCode =
            HttpStatus.NOT_FOUND;

    }

}

module.exports = NotFoundError;