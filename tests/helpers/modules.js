const fs = require("fs");
const os = require("os");
const path = require("path");

function fixture(modules = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "backend-core-test-"));
    for (const [name, code] of Object.entries(modules)) {
        const directory = path.join(root, name);
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, "index.js"), code);
    }
    return {
        root,
        cleanup() {
            const resolved = path.resolve(root);
            if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("backend-core-test-")) {
                throw new Error("Unsafe fixture cleanup path");
            }
            fs.rmSync(resolved, { recursive: true, force: true });
        }
    };
}
const logger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() });
module.exports = { fixture, logger };
