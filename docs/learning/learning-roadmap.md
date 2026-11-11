# Learning Roadmap

Use each repository milestone as a focused learning unit. Do not study every framework at once; build, test, and explain one boundary at a time.

## 1. Existing React application and engineering baseline

Learn:

- How Vite differs from the TypeScript compiler.
- Why a bundler can succeed while `tsc --noEmit` fails.
- Static imports, route-based code splitting, and bundle size.
- Browser storage schemas, safe parsing, migrations, and data ownership.
- Unit, component, and end-to-end test responsibilities.
- CI reproducibility, Node engine ranges, and lockfiles.

Practice:

- Fix one type error at a time and explain the compiler's reasoning.
- Write tests around `runMigrations()` before changing it.
- Add one Playwright navigation smoke test.

## 2. Java and Spring Boot

Learn:

- Java records/classes, interfaces, generics, exceptions, and dependency injection.
- HTTP semantics and REST resource design.
- Controller, service, repository, DTO, and mapping responsibilities.
- Bean Validation and centralized error handling.
- Authentication versus authorization.
- JUnit, mocking, integration testing, and Testcontainers.

Practice:

- Build one endpoint through every layer.
- Explain why entities do not cross the API boundary.
- Test success, invalid input, missing data, and unauthorized access.

## 3. PostgreSQL and persistence

Learn:

- Tables, keys, constraints, indexes, transactions, and normalization.
- JPA entity lifecycle and the N+1 query problem.
- Forward-only schema migrations with Flyway.
- Connection configuration and secret management.

Practice:

- Write the migration before the repository implementation.
- Inspect generated SQL and query plans for a real feature.
- Restore a local database from scratch using only migrations.

## 4. Angular

Learn:

- Standalone components, templates, signals/observables, and dependency injection.
- Feature routes and lazy loading.
- Reactive forms and typed validation.
- HTTP interceptors and typed API clients.
- Component testing and accessible interaction design.

Practice:

- Reproduce a small React page without changing its behavior.
- Map React state/effects to the appropriate Angular concepts.
- Preserve route and storage compatibility during migration.

## 5. Python and FastAPI

Learn:

- Type hints, virtual environments, packages, async I/O, and exception handling.
- Pydantic request/response models.
- Dependency injection and service boundaries in FastAPI.
- Pytest fixtures and Ruff.
- Why an AI-oriented service still needs deterministic contracts and tests.

Practice:

- Start with a pure function and tests, then expose it through one endpoint.
- Validate malformed and oversized payloads.
- Add timeouts and explicit failure mapping at the Java-to-Python boundary.

## 6. System integration and operations

Learn:

- Same-origin policy, CORS, cookies/tokens, TLS, and API versioning.
- Container images, Compose networking, health checks, and graceful shutdown.
- CI job isolation, dependency caching, artifacts, and deployment environments.
- Structured logs, metrics, backups, and rollback.

## The six-question learning template

For every significant implementation, add an entry to `learning-log.md` answering:

1. **WHAT** changed?
2. **WHY** is it needed?
3. **WHERE** are the files?
4. **HOW** does the code work?
5. **TEST** which commands and behaviors verify it?
6. **LEARN** which concept should be understood before moving on?
