# Phased Migration Roadmap

The rule for every milestone is: define acceptance criteria, implement a small vertical slice, run its checks, update the learning log, and stop before the next milestone until the current one is green.

## Milestone 1 — Repository discovery (complete)

The repository, routes, dependencies, deployment workflow, storage behavior, current structure, and target architecture were audited and documented.

## Milestone 2 — Stabilize the current repository (complete)

### Outcomes

- Resolve the existing TypeScript errors. Completed.
- Add Vite client types and make type-checking part of `npm run build` or CI.
- Align GitHub Actions with a supported Node version. Completed with Node 22.
- Choose npm or pnpm and retain one lockfile. Completed with npm.
- Remove the four confirmed unused dependencies with the chosen package manager. Completed.
- Replace the destructive startup cleanup with a versioned, tested migration. Completed.
- Add ESLint with a small, conventional configuration. Completed.
- Add Vitest coverage for storage migrations and pure utilities. Completed.
- Add Playwright smoke tests for startup, navigation, mobile behavior, data persistence, and PDF export. Completed.
- Lazy-load non-home routes and measure initial versus total JavaScript. Completed.
- Decide the canonical production URL, base path, and direct-link strategy.

### Exit criteria

- Clean install, type-check, lint, unit tests, end-to-end smoke tests, and production build all pass in CI.
- Existing public routes and locally stored user work remain functional.
- Deployment documentation matches the actual live configuration.

## Milestone 3 — Spring Boot API foundation

### Outcomes

- Create `apps/api` with Maven and a supported Java LTS release selected against the chosen Spring Boot version.
- Begin as a modular monolith, not multiple microservices.
- Add one small, useful endpoint with controller, DTO, validation, service, mapper, and test layers.
- Add centralized error responses and initial Spring Security configuration.
- Publish OpenAPI documentation.

### Exit criteria

- Unit and integration tests pass.
- Example request/response and local run commands are documented.
- No database dependency is introduced until the endpoint requires persistence.

## Milestone 4 — PostgreSQL integration

### Outcomes

- Add PostgreSQL for one durable feature.
- Add Flyway migrations and Testcontainers-backed integration tests.
- Keep JPA entities internal; expose DTOs at HTTP boundaries.
- Add environment-based configuration and a secrets-free `.env.example`.

### Exit criteria

- A new database can be created entirely from migrations.
- Repository, service, validation, rollback, and error behavior are tested.

## Milestone 5 — Angular foundation

### Outcomes

- Create `apps/web` with standalone components, strict TypeScript, feature routes, and accessible shared UI.
- Establish design tokens that reproduce the current site rather than redesigning it.
- Add a typed API client generated from or checked against OpenAPI.
- Add Angular unit tests and Playwright smoke tests.

### Exit criteria

- The Angular shell deploys to a non-production preview.
- Navigation, responsive layout, theme behavior, and accessibility smoke checks pass.
- The React production site remains untouched.

## Milestone 6 — Incremental frontend migration

Migrate one low-risk feature at a time. For each feature:

1. Record existing routes, screenshots, state keys, and behavior.
2. Add characterization tests against the React implementation.
3. Implement the Angular equivalent using shared tokens and typed services.
4. Run both versions in preview and compare behavior/responsiveness.
5. Preserve or explicitly migrate browser data.
6. Switch the route only after acceptance, keeping a rollback path.

Start with a mostly static page. Leave media recording, document parsing, and state-heavy trackers until later.

## Milestone 7 — FastAPI service

Only begin when a concrete Python-specific need exists, such as an evaluated ML/NLP capability that does not belong comfortably in Java.

### Outcomes

- Create `apps/ai-service` with supported Python, FastAPI, Pydantic, typed service code, pytest, Ruff, and environment configuration.
- Keep integrations isolated and expose a narrow internal contract.
- Route public clients through Spring Boot unless direct access is intentionally designed and secured.

### Exit criteria

- Unit and contract tests pass.
- Failure, timeout, privacy, and payload-size behavior are documented.

## Milestone 8 — Integrated testing

- Add contract tests between Angular and Spring Boot and between Spring Boot and FastAPI.
- Add end-to-end tests for critical user journeys.
- Add accessibility and responsive viewport checks.
- Add test fixtures that contain no personal or secret data.

## Milestone 9 — Containers, CI/CD, and deployment

- Add production-oriented Dockerfiles only for services that exist.
- Add a local Compose stack for API, database, and optional Python service.
- Cache dependencies and run independent CI jobs for each changed application.
- Separate preview, staging, and production configuration.
- Add health checks, structured logs, backup/restore notes, and deployment rollback instructions.

## Current run commands

From the repository root with Node 20.19+ or 22.12+:

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run build
npx.cmd tsc --noEmit
npm.cmd run test
npm.cmd run lint
npm.cmd run test:e2e
```

There are no backend or Python service commands yet because those applications have not been created.
