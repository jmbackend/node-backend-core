const HttpStatus =
    require("../http/HttpStatus");

const HttpMessages =
    require("../http/HttpMessages");

class ConflictError extends Error {

    constructor(message = HttpMessages.CONFLICT) {

        super(message);

        this.name = "ConflictError";

        this.statusCode =
            HttpStatus.CONFLICT;

    }

}

module.exports = ConflictError;