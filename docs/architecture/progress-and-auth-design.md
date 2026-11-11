# Progress and Authentication Design

## Scope

Milestone 6 adds the first authenticated database write without changing the public roadmap DTOs or importing browser data. The React application and its `pd:resources:certs:*` localStorage keys remain independent. Local storage proves only that one browser has a value; it does not identify a person and is never accepted as ownership evidence.

## Domain model

```text
application_users (1) -> (many) user_stage_progress (many) -> (1) roadmap_stages
```

`application_users.subject` is the stable identity key. For local development it matches one of two fixed Spring Security principals, `learner` or `reviewer`. The database uses generated numeric keys internally; clients never submit a user ID.

Each `user_stage_progress` row contains:

- the owning user and referenced roadmap stage;
- `NOT_STARTED`, `IN_PROGRESS`, or `COMPLETED`;
- a completion timestamp only when completed;
- the last-updated timestamp;
- a JPA `@Version` value for optimistic locking.

The unique `(user_id, stage_id)` constraint permits one current state per user and stage. Foreign keys reject nonexistent users or stages. Check constraints protect status, completion timestamp, and version invariants even when a write does not pass through Java.

## Ownership boundary

```text
Authorization header -> Spring Security principal -> subject lookup -> owner-filtered query/write
```

The progress request contains status and, for updates, the last version observed by the client. It has no `userId` or `subject`. `ProgressController` obtains `Principal.getName()` from Spring Security, and `ProgressService` always uses that subject in repository queries. Consequently, changing JSON cannot select another owner.

`GET /api/v1/progress` returns only the authenticated principal's rows. `PUT /api/v1/progress/roadmaps/{roadmapId}/stages/{stageSequence}` creates that principal's row or updates it when the supplied version matches. The public slug and sequence resolve the stage while its numeric database key stays internal.

## Local authentication

Spring Security's built-in stateless HTTP Basic support is used only for local development and automated tests. Passwords are required through `LOCAL_LEARNER_PASSWORD` and `LOCAL_REVIEWER_PASSWORD`; no password is committed or compiled into React. Passwords are encoded in memory by Spring Security and are not stored in PostgreSQL.

HTTP Basic must be used only over trusted local transport or TLS. It is not the production identity design. Production should use an external OpenID Connect provider and Spring Security OAuth2 Resource Server. The provider's immutable `sub` claim should map to `application_users.subject`; display names and email addresses are not stable ownership keys.

CSRF protection is disabled for this stateless, non-cookie local API. A future cookie-authenticated browser integration must enable CSRF protection. A bearer-token API should remain stateless and use a narrow CORS policy or, preferably, same-origin routing.

## Authorization rules

- `GET /api/v1/roadmaps` and valid roadmap detail reads are public.
- `/actuator/health` is public without details.
- `/api/v1/progress/**` requires authentication.
- Unrecognized `/api/**` routes and all other routes are denied.
- The API returns structured `AUTHENTICATION_REQUIRED` (401) and `ACCESS_DENIED` (403) responses.

Resource ownership is enforced in the service/repository query, not by a role alone. Both local users have `ROLE_USER`, but that role does not grant access to each other's rows.

## Write and concurrency behavior

The stage URL identifies the resource, so PUT is used as an upsert:

```json
{ "status": "IN_PROGRESS" }
```

A new row returns 201 and version `0`. Updating it requires the current version:

```json
{ "status": "COMPLETED", "version": 0 }
```

The successful update returns 200 and version `1`. A stale or missing update version returns 409 `PROGRESS_CONFLICT`. The explicit version check gives an immediate useful message; JPA `@Version` remains the final defense if two transactions race after that check.

`ProgressService.upsert` is the read-write transaction boundary. `saveAndFlush` exposes constraint and optimistic-lock failures inside the transaction, allowing them to be translated into 409 while the runtime exception rolls the transaction back.

## Status codes

- 200: existing progress updated or owned progress listed.
- 201: progress created; `Location` identifies the stage progress URL.
- 400: malformed JSON, unsupported status, or invalid input.
- 401: no valid authentication.
- 403: authenticated but denied or not provisioned.
- 404: referenced stage does not exist.
- 409: stale version or duplicate concurrent creation.

## Deferred production work

- OIDC provider selection, issuer/audience validation, and account provisioning.
- TLS and production secret management.
- Rate limiting and authentication audit events.
- Browser login/user experience and CSRF/CORS decision.
- Explicit reconciliation of localStorage progress with server progress.
