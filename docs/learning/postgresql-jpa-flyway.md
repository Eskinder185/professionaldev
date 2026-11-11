# PostgreSQL, JPA, and Flyway

## Tables and relationships

A relational table stores rows with a consistent set of columns. `roadmaps` stores one row per public catalog entry. `roadmap_stages` stores multiple rows for each roadmap, and `stage_outcomes` stores multiple rows for each stage.

The model is one-to-many twice:

```text
one roadmap -> many stages -> many outcomes
```

This structure avoids repeating roadmap titles on every stage or storing arrays in a single text column.

## Primary and foreign keys

A primary key uniquely identifies a row. The schema uses generated `BIGINT` primary keys for internal joins. The roadmap slug has a separate unique constraint because it is the stable public identifier.

A foreign key ensures a child references a real parent. PostgreSQL therefore rejects an outcome with an unknown stage or a stage with an unknown roadmap. `ON DELETE CASCADE` means deleting a catalog roadmap also deletes its owned stages and outcomes; it does not affect browser storage.

## Normalization

Normalization separates distinct facts and repeating groups. In this schema:

- roadmap metadata depends on the roadmap;
- a stage title and position depend on its roadmap and stage identity;
- outcome text and position depend on its stage.

The ordering constraints prevent two stages from claiming the same position within one roadmap and prevent two outcomes from claiming the same position within one stage.

## JDBC and connection pools

JDBC is Java's database API. The PostgreSQL JDBC driver translates JDBC calls into PostgreSQL's wire protocol.

Opening a new physical database connection for every request is expensive. HikariCP maintains a small pool of reusable connections. Spring Boot configures it automatically through the JPA starter and `spring.datasource.*` properties.

The browser never connects to PostgreSQL. React calls Spring Boot over HTTP; Spring Boot obtains a JDBC connection from HikariCP.

## JPA entities versus DTOs

JPA entities model persisted rows and relationships. They contain database-oriented details such as generated numeric IDs, foreign keys, lazy collections, and column names.

DTOs model the public HTTP contract. `RoadmapResponse.id` remains the slug and has no database-generated key. Keeping entities out of controllers prevents database refactors from accidentally changing JSON.

## Spring Data repositories

`RoadmapRepository` extends `JpaRepository`. Spring Data generates routine query behavior from the interface. Custom methods express the two queries this feature needs: load the complete ordered catalog and load one roadmap by slug.

There is no additional repository interface or adapter because Spring Data already supplies the required persistence boundary.

## Hibernate ORM

Hibernate implements JPA. It turns entity queries into SQL and maps result rows back into objects. ORM reduces repetitive JDBC mapping, but developers still need to understand the SQL shape, constraints, joins, and transaction behavior.

`ddl-auto=validate` tells Hibernate to compare mappings with the existing schema. Flyway remains the only schema author.

## Transactions

A transaction groups database work into a consistent unit. The roadmap service declares read-only transactions. This keeps entity loading and DTO mapping within a clear boundary and allows Spring/Hibernate to apply read optimizations.

Write operations would need explicit transaction boundaries so either all related rows change or none do.

## Lazy and eager loading

Lazy relationships are loaded only when accessed. This avoids retrieving a large graph when it is not needed, but accessing lazy children after the transaction closes fails.

Eager loading always retrieves a relationship and can make unrelated queries unexpectedly expensive. This project keeps mappings lazy and chooses the complete graph only in repository methods that need API DTOs.

## The N+1 query problem

N+1 occurs when one query loads parent rows and then one additional query runs for each parent's children. Nested collections can multiply the problem.

The repository entity graph joins roadmaps, stages, and outcomes for the catalog read. Both child relationships use sets internally so Hibernate can fetch the graph without multiple-bag errors. The service explicitly sorts by persisted order before creating list-based DTOs. A Hibernate statistics test asserts one prepared statement.

## Flyway migration versioning

Flyway reads scripts from `db/migration`, applies unapplied versions in order, and records checksums. `V1` creates structure and `V2` inserts catalog data.

Never rewrite an applied migration just because the desired schema changed. Add `V3`, `V4`, and so on. This preserves a reproducible history from an empty database to the current state.

## Integration testing with Testcontainers

Testcontainers starts a real disposable PostgreSQL container for the Maven test process. Each clean container proves Flyway can build the database from nothing. Random host ports avoid conflicts with local PostgreSQL services.

These tests are slower than mocked unit tests but catch PostgreSQL-specific SQL, mapping mismatches, constraint failures, and startup problems that mocks cannot.

## SQL exercises

Run these against the local Compose database using your own development credentials.

1. Select all roadmap titles and durations:

   ```sql
   SELECT title, estimated_weeks FROM roadmaps;
   ```

2. Filter for longer roadmaps:

   ```sql
   SELECT slug, title FROM roadmaps WHERE estimated_weeks >= 12;
   ```

3. Join roadmaps to their stages:

   ```sql
   SELECT r.slug, s.stage_order, s.title
   FROM roadmaps r
   JOIN roadmap_stages s ON s.roadmap_id = r.id
   ORDER BY r.id, s.stage_order;
   ```

4. Join all three tables for the Java roadmap:

   ```sql
   SELECT s.stage_order, s.title, o.outcome_order, o.outcome_text
   FROM roadmaps r
   JOIN roadmap_stages s ON s.roadmap_id = r.id
   JOIN stage_outcomes o ON o.stage_id = s.id
   WHERE r.slug = 'java-spring-backend'
   ORDER BY s.stage_order, o.outcome_order;
   ```

5. Count stages per roadmap:

   ```sql
   SELECT r.slug, COUNT(s.id) AS stage_count
   FROM roadmaps r
   LEFT JOIN roadmap_stages s ON s.roadmap_id = r.id
   GROUP BY r.id, r.slug
   ORDER BY r.slug;
   ```

6. Explain why inserting a duplicate `(roadmap_id, stage_order)` should fail, then try it inside a transaction and roll the transaction back.

7. Use `EXPLAIN` on the three-table join and identify which primary-key or unique indexes PostgreSQL chooses.

8. Add a fictional roadmap on paper. Write the three `INSERT` groups in dependency order without changing the checked-in seed migration.
