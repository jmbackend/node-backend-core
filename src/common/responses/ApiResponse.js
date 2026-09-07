class ApiResponse {

    static success(
        data = null,
        message = "Operation completed successfully."
    ) {

        return {

            success: true,

            message,

            data

        };

    }

    static error(
        message = "An unexpected error occurred.",
        errors = []
    ) {

        return {

            success: false,

            message,

            errors

        };

    }

    static paginated(
        data,
        pagination,
        message = "Operation completed successfully."
    ) {

        return {

            success: true,

            message,

            data,

            pagination

        };

    }

}

module.exports = ApiResponse;