# Spring Security and Transactions

## Authentication and authorization

Authentication answers “who made this request?” Spring Security turns valid local HTTP Basic credentials into an `Authentication` and exposes its name as the request principal.

Authorization answers “may this identity perform this operation?” The filter chain decides whether a route is public, authenticated, or denied. `ProgressService` then applies resource authorization by querying only rows owned by that principal.

Roles and ownership solve different problems. A role such as `ROLE_USER` can permit a category of action. It cannot prove that a particular progress row belongs to that user. Ownership must be present in the query or business rule.

## Why localStorage is not identity

Browser storage is controlled by that browser profile and can be edited with developer tools. A key or user ID copied from localStorage is client input, not authenticated evidence. The server therefore ignores browser-owned progress and derives the owner from Spring Security.

## POST and PUT

POST normally creates a new subordinate resource and lets the server choose its identifier. PUT replaces or creates the resource identified by the URL. This API uses:

```text
PUT /api/v1/progress/roadmaps/{roadmapId}/stages/{stageSequence}
```

because a user has at most one progress resource per stage and the URL identifies that resource naturally.

## Transaction boundaries

`@Transactional` makes a service method one database unit of work. A successful method commits. An uncaught runtime exception marks the transaction for rollback by default. Keeping the boundary in the service allows lookup, ownership rules, status changes, and flush to succeed or fail together.

Read methods use `@Transactional(readOnly = true)`. A write method uses the default read-write transaction and calls `saveAndFlush` so database and optimistic-lock errors occur before the method returns.

## Constraints and optimistic locking

Java validation gives fast, useful API errors. PostgreSQL constraints are still essential because imports, maintenance scripts, bugs, or another application can bypass the controller.

`@Version` maps the numeric `version` column. Hibernate includes the old version in the SQL update condition and increments it after a successful update. If another request has already changed that row, the old update cannot silently overwrite it. This API reports the conflict as HTTP 409 and asks the caller to reload.

## 401, 403, 404, and 409

- 401 means the server cannot authenticate the caller.
- 403 means the caller is authenticated but not permitted.
- 404 means an allowed request references a resource that does not exist.
- 409 means the request conflicts with current resource state, such as a stale version.

Avoid using 403 for bad passwords, 401 for missing domain records, or 500 for expected concurrency.

## Spring Security tests

`spring-security-test` attaches the real security filter chain to MockMvc. `httpBasic` constructs a real Authorization header. The tests verify public reads, unauthenticated writes, default-deny behavior, and owner isolation. PostgreSQL Testcontainers verifies the same service and constraints against PostgreSQL rather than H2.

## Exercises

1. Trace an unauthenticated PUT through `SecurityFilterChain`, `ApiAuthenticationEntryPoint`, and `ApiError`.
2. Add a test showing that the reviewer may create their own row for the same stage as the learner and verify two database rows exist.
3. Write SQL that joins progress to subject, roadmap slug, and stage order without selecting password data.
4. Try inserting `COMPLETED` with a null `completed_at` inside a transaction and explain the failed check constraint. Roll back afterward.
5. Explain why a request body containing `"userId": 1` must never change ownership, even if JSON parsing ignores the field.
6. Draw two clients reading version 0, one committing version 1, and the other receiving 409.
7. Change a test request to omit the update version and inspect the structured conflict response.
8. On paper, replace HTTP Basic with OIDC. Identify the issuer, audience, `sub` claim, account-provisioning step, and where TLS is enforced.

## Official references

- <https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/basic.html>
- <https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html>
- <https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/>
- <https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html>
- <https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html>
