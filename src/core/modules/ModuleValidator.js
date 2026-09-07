class ModuleValidator {
    static validate(module) {
        if (!module || typeof module !== "object" || typeof module.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(module.name)) {
            throw new Error("Module must have a valid lowercase name.");
        }
        if (typeof module.version !== "string" || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(module.version)) {
            throw new Error(`Module "${module.name}" must have a semantic version.`);
        }
        for (const field of ["dependencies", "optionalDependencies"]) {
            if (module[field] !== undefined && (!Array.isArray(module[field]) ||
                module[field].some(name => typeof name !== "string" || !/^[a-z][a-z0-9-]*$/.test(name)) ||
                new Set(module[field]).size !== module[field].length)) {
                throw new Error(`Module "${module.name}" has invalid ${field}.`);
            }
        }
        for (const hook of ["register", "registerModels", "associate", "boot", "shutdown"]) {
            if ((hook === "register" || module[hook] !== undefined) && typeof module[hook] !== "function") {
                throw new Error(`Module "${module.name}" must provide a function for ${hook}.`);
            }
        }
        for (const field of ["migrations", "seeders"]) {
            if (module[field] !== undefined && (!Array.isArray(module[field]) || module[field].some(file => typeof file !== "string"))) {
                throw new Error(`Module "${module.name}" has invalid ${field}.`);
            }
        }
        return module;
    }
}

module.exports = ModuleValidator;
