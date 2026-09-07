const fs = require("fs");
const path = require("path");
const morgan = require("morgan");

const logDir = path.join(__dirname, "../../logs");

const accessLogStream =
    fs.createWriteStream(

        path.join(
            logDir,
            "http.log"
        ),

        {

            flags: "a"

        }

    );

module.exports = morgan(

    "combined",

    {

        stream:
            accessLogStream

    }

);