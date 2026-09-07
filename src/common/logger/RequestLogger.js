const logger =
    require("./Logger");

module.exports = (req, res, next) => {

    logger.info(

        `${req.method} ${req.originalUrl}`

    );

    next();

};