# Roadmap Database Design

## Scope

Milestone 5 replaces the API's hardcoded roadmap collection with PostgreSQL persistence. The REST paths, DTO field names, seed content, validation errors, and `ROADMAP_NOT_FOUND` behavior remain unchanged. Browser-owned user progress remains separate and is never migrated into these catalog tables.

The implementation uses PostgreSQL 17.6, Spring Data JPA, Hibernate ORM, Flyway migrations, HikariCP, and Testcontainers.

## Relationship model

```text
roadmaps (1)
    |
    | roadmap_id, ON DELETE CASCADE
    v
roadmap_stages (many)
    |
    | stage_id, ON DELETE CASCADE
    v
stage_outcomes (many)
```

A roadmap has ordered stages. A stage has ordered outcome strings. Separating these repeating groups produces a normalized model and lets PostgreSQL enforce ownership and ordering independently.

## Tables and constraints

### `roadmaps`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `BIGINT` identity | Internal primary key |
| `slug` | `VARCHAR(100)` | Non-null, unique, lowercase slug check |
| `title` | `VARCHAR(200)` | Non-null, not blank |
| `description` | `TEXT` | Non-null, not blank |
| `target_role` | `VARCHAR(160)` | Non-null, not blank |
| `estimated_weeks` | `SMALLINT` | Non-null, 1 through 520 |

The numeric key is an internal relational identifier. The stable slug remains the public API ID, so database implementation details do not leak into URLs.

### `roadmap_stages`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `BIGINT` identity | Primary key |
| `roadmap_id` | `BIGINT` | Non-null foreign key to `roadmaps.id` |
| `stage_order` | `SMALLINT` | Positive; unique per roadmap |
| `title` | `VARCHAR(200)` | Non-null, not blank |

### `stage_outcomes`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `BIGINT` identity | Primary key |
| `stage_id` | `BIGINT` | Non-null foreign key to `roadmap_stages.id` |
| `outcome_order` | `SMALLINT` | Positive; unique per stage |
| `outcome_text` | `TEXT` | Non-null, not blank |

The unique constraints on `(roadmap_id, stage_order)` and `(stage_id, outcome_order)` create B-tree indexes whose leading columns also support child lookup and cascading foreign-key operations. Separate duplicate indexes are intentionally avoided.

## Migrations

Flyway owns the schema:

- `V1__create_roadmap_schema.sql` creates tables, keys, checks, and ordering constraints.
- `V2__seed_roadmap_catalog.sql` inserts the exact AWS, Security+, and Java/Spring catalog from Milestone 3.
- `V3__create_user_progress.sql` adds stable local identities and normalized, versioned stage progress without changing catalog rows.

Flyway records each checksum and installed version in `flyway_schema_history`. Applied versioned migrations must never be edited in a shared environment; corrections belong in a new migration. The seed is deterministic and executes once per database through Flyway version tracking.

Hibernate is configured with `ddl-auto=validate`. Startup fails if entity mappings disagree with the migrated schema. Hibernate does not create, update, or silently repair tables.

## JPA model and API mapping

`RoadmapEntity`, `RoadmapStageEntity`, and `StageOutcomeEntity` map database rows and relationships. They are separate from `RoadmapResponse` and `RoadmapStageResponse`, which remain the public API contract.

Relationships are lazy by default. `RoadmapRepository` applies an entity graph for both nested relationships on the two catalog queries. The service maps the fully loaded graph inside a read-only transaction and sorts by the persisted order fields. Integration tests enable Hibernate statistics and verify the complete collection is loaded with one prepared SQL statement rather than an N+1 sequence.

No custom repository wrapper was added. `RoadmapRepository` is the Spring Data boundary, and `RoadmapService` owns entity-to-DTO mapping and missing-resource behavior.

## Transactions

Both service operations use `@Transactional(readOnly = true)`. This keeps the persistence context open during mapping, declares intent to Spring and Hibernate, and prevents lazy access from escaping into the controller. Open Session in View is disabled with `spring.jpa.open-in-view=false`.

Flyway migrations run in their own startup lifecycle before Hibernate validates mappings and before the application serves requests.

## Configuration

The application reads:

- `DB_HOST` — default `127.0.0.1`
- `DB_PORT` — default `5432`
- `DB_NAME` — default `roadmap`
- `DB_USER` — default `roadmap_dev`
- `DB_PASSWORD` — default `roadmap_dev_password`

Defaults are intentionally local-only. Deployment environments must override every connection setting with managed secrets. No database credential is sent to React.

## Local Docker environment

`apps/api/compose.yaml` defines PostgreSQL 17.6 with:

- host binding restricted to `127.0.0.1`;
- named volume `roadmap-postgres-data`;
- `pg_isready` health check;
- environment-configurable database, user, password, and host port.

Start it without deleting any existing volume:

```powershell
Set-Location apps/api
docker compose up -d
docker compose ps
```

The default host port is `5432`. If another local database already owns it, set
an alternate localhost port before both Compose and the API start, for example:

```powershell
$env:DB_PORT = '55432'
docker compose up -d --wait
./mvnw.cmd spring-boot:run
```

Stop the container while retaining its data:

```powershell
docker compose down
```

Do not add `--volumes` unless permanent local data deletion is explicitly intended.

## Test strategy

A shared Testcontainers fixture starts an isolated PostgreSQL 17.6 database. Spring points its DataSource at the random mapped port, Flyway migrates the empty schema, and Hibernate validates it. Tests verify:

- migration versions and seeded row counts;
- exact DTO content and ordering;
- unique and foreign-key constraints;
- one-query nested catalog loading;
- HTTP success, 400, and 404 behavior;
- application context startup.

No H2 substitute is used, so PostgreSQL SQL, constraints, Flyway support, and JDBC behavior are exercised directly.

Milestone 6 progress ownership, write transactions, and security are documented in `progress-and-auth-design.md`.
