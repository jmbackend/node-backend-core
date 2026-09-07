const {
    validationResult
} = require("express-validator");

const ValidationError =
    require("../exceptions/ValidationError");

class BaseValidator {

    rules() {

        return [];

    }

    validate() {

        return [

            ...this.rules(),

            this.handleValidation

        ];

    }

    handleValidation(req, res, next) {

        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {

            return next(

                new ValidationError(

                    errors.array(),

                    "Validation failed."

                )

            );

        }

        next();

    }

}

module.exports = BaseValidator;
