# Node Backend Core - Agent Guide

This CommonJS project provides Express 5, Sequelize 6/MySQL, logging, responses,
errors, base classes and a module lifecycle. src/modules may be empty.

## Conventions

- Preserve the existing BaseController, BaseService, BaseRepository, BaseValidator,
  BaseMapper, BaseDTO and ApiResponse behavior.
- Feature code belongs in optional modules. Do not introduce business models,
  authentication providers, storage providers or scheduled tasks in the Core.
- Feature request flow: routes -> validators -> controllers -> services -> repositories.
- Extend base classes, use express-validator, transform responses through DTOs,
  and pass controller errors to next(error).
- Export feature services as singleton instances.
- Modules receive shared APIs through context.core and infrastructure through context.
  Do not import another module's internals.
- Register models in registerModels(context), then associations in associate(context).
- Add module routes through context.router; they mount under /api/v1.
- Declare dependencies in the module entrypoint, never in app.js or server.js.
- See docs/modules.md for discovery, lifecycle, events and database resources.

## Checks

- npm install
- npm test -- --runInBand
- npm run test:integration (requires TEST_DB_* configuration)
- docker compose up --build
- GET /health and GET /api/docs.json

Keep .env and migration-backup out of Git and Docker. Never remove database
volumes as part of a source refactor. Document new Core configuration in .env.example.
