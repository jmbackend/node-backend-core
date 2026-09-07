const HttpStatus =
    require("../http/HttpStatus");

const HttpMessages =
    require("../http/HttpMessages");

class ValidationError extends Error {

    constructor(
        errors = [],
        message = HttpMessages.VALIDATION_ERROR
    ) {

        super(message);

        this.name = "ValidationError";

        this.statusCode =
            HttpStatus.UNPROCESSABLE_ENTITY;

        this.errors = errors;

    }

}

module.exports = ValidationError;