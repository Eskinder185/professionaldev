# Frontend-Backend Integration

## Scope

Milestone 4 connects the existing React roadmap route to the Spring Boot roadmap catalog. The integration is deliberately read-only. It does not move, rename, delete, or populate browser storage, and it does not alter deployment.

The existing AWS and Security+ content remains visible as static application content. A separate section fetches the `java-spring-backend` catalog entry and labels it as data from the live API. An API failure is shown as a failure; static content is never presented as though it came from Spring Boot.

## Existing frontend data versus the API contract

| Concern | Existing React roadmap content | Certification planning state | Spring Boot DTO |
| --- | --- | --- | --- |
| Purpose | Small static certification guide | User-owned path selection and progress | Read-only sample catalog |
| Location | `pages/Resources/Roadmaps.tsx` | `pages/Resources/CertsLearning.tsx` | `apps/api/.../roadmap/dto` |
| Shape | JSX headings and bullet strings | `Path` objects, completed milestones, hours, links | Typed roadmap and ordered stage records |
| Identity | Display title only | Local path ID | Stable URL-slug `id` |
| Storage | None | `pd:resources:certs:*` localStorage keys | Server memory only |
| Progress | None | User-controlled completion map | None |
| Ownership | Application content | Browser user data | PostgreSQL-backed backend catalog data |

The semantics are related but not interchangeable. In particular, API stages must not overwrite local completion data.

## Frontend API layer

```text
src/lib/api/
|-- http.ts       HTTP execution, error mapping, cancellation
|-- roadmaps.ts   Roadmap paths and runtime DTO validation
`-- types.ts      TypeScript representations of Java response records
```

`requestJson` accepts a runtime validator because TypeScript types disappear when JavaScript runs. A server, proxy, or malformed fixture can return any JSON regardless of the compile-time declaration. Data becomes a `RoadmapResponse` only after its nested fields have been checked.

Failures are represented by `ApiClientError` with these kinds:

- `validation` for HTTP 400
- `not-found` for HTTP 404
- `server` for HTTP 500 and other 5xx responses
- `http` for other unsuccessful HTTP responses
- `network` when no response can be obtained
- `malformed-response` when successful JSON violates the DTO contract
- `aborted` when an `AbortSignal` cancels the request

Backend error bodies are retained when they match `ApiErrorResponse`. No authentication token, URL secret, or environment secret is compiled into the browser.

## Request flow

```text
Roadmaps component
    -> listRoadmaps({ signal })
        -> requestJson('/api/v1/roadmaps')
            -> Vite development proxy
                -> Spring Boot :8080
                    -> RoadmapController
                        -> RoadmapService
```

The browser always calls the same-origin path `/api/v1/roadmaps`. In development, Vite forwards `/api` to Spring Boot. In a future hosted environment, the hosting layer needs to route that path to the API or the UI will honestly show that the API is unavailable.

## Vite development proxy

`vite.config.ts` retains the GitHub Pages base path `/professionaldev/` and adds a development-only proxy. The default target is `http://127.0.0.1:8080`.

Set `ROADMAP_API_PORT` before starting Vite when Spring Boot uses a different port:

```powershell
$env:ROADMAP_API_PORT = '18080'
npm.cmd run dev
```

Only a numeric port is accepted. This variable is consumed by Vite's Node configuration and has no `VITE_` prefix, so Vite does not expose it to client code. It is configuration, not a secret. No Spring CORS wildcard is needed because the browser requests the Vite origin.

The production build does not run the development proxy. Keeping the existing `base` value preserves GitHub Pages asset and route behavior.

## React lifecycle and UI states

The roadmap page begins in `loading`, calls `listRoadmaps` inside `useEffect`, and selects the catalog item whose ID is `java-spring-backend`.

- Loading renders an announced status.
- Success renders catalog metadata and ordered stages.
- A valid collection without the Java entry renders an empty state.
- A failed request renders an alert and retry action.
- Retry increments a request counter, causing a new effect and request.
- Effect cleanup aborts the old request when the component unmounts or a newer request replaces it.

An aborted request does not render an error because it is expected lifecycle cleanup. Other failures remain visible. The page does not implement a Java-roadmap fallback, so there is no risk of silently disguising stale local content as an API response.

## Tests

The API client tests cover successful list and single-resource responses, 400, 404, 500, network failure, malformed success data, and cancellation.

Component tests cover loading, success, empty data, visible failure, and retry. Existing static guides remain in the component while all API behavior is mocked at the client boundary.

Playwright intercepts the API path for deterministic normal regression runs. Set `LIVE_API=1` to disable that interception and exercise the real Vite-to-Spring proxy while the backend is running.

```powershell
$env:LIVE_API = '1'
$env:ROADMAP_API_PORT = '18080'
npm.cmd run test:e2e -- --grep "Java roadmap" --project desktop-chromium
```

## Local startup

API terminal:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
Set-Location C:\Users\eskew\github\professionaldev\apps\api
.\mvnw.cmd spring-boot:run
```

Frontend terminal:

```powershell
Set-Location C:\Users\eskew\github\professionaldev
npm.cmd run dev
```

Open `http://localhost:5173/professionaldev/resources/roadmaps` using the port Vite prints.

## Deferred work

- Production API hosting and same-origin routing are not configured.
- DTOs are hand-maintained in Java and TypeScript; an OpenAPI contract could reduce future drift.
- There is no cache, timeout policy, or request observability yet.
- The public catalog remains read-only. Authenticated progress writes now exist for local API testing, but React does not call them yet.
- Browser progress and server progress intentionally have no reconciliation or migration behavior in Milestone 6.
