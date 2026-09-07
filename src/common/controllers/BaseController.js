const ApiResponse =
    require("../responses/ApiResponse");

class BaseController {
    constructor(service = null) {

        this.service = service;

    }

    success(
        res,
        data = null,
        message = "OK"
    ) {

        return res.status(200).json(

            ApiResponse.success(
                data,
                message
            )

        );

    }

    created(
        res,
        data = null,
        message = "Created"
    ) {

        return res.status(201).json(

            ApiResponse.success(
                data,
                message
            )

        );

    }

    noContent(res) {

        return res.status(204).send();

    }

    badRequest(
        res,
        message = "Bad Request",
        errors = []
    ) {

        return res.status(400).json(

            ApiResponse.error(
                message,
                errors
            )

        );

    }

    unauthorized(
        res,
        message = "Unauthorized"
    ) {

        return res.status(401).json(

            ApiResponse.error(
                message
            )

        );

    }

    forbidden(
        res,
        message = "Forbidden"
    ) {

        return res.status(403).json(

            ApiResponse.error(
                message
            )

        );

    }

    notFound(
        res,
        message = "Resource not found"
    ) {

        return res.status(404).json(

            ApiResponse.error(
                message
            )

        );

    }

    conflict(
        res,
        message = "Conflict"
    ) {

        return res.status(409).json(

            ApiResponse.error(
                message
            )

        );

    }

    error(
        res,
        message = "Internal Server Error"
    ) {

        return res.status(500).json(

            ApiResponse.error(
                message
            )

        );

    }

}

module.exports = BaseController;