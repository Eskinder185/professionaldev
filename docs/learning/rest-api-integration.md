# REST API Integration

## HTTP requests and responses

An HTTP request has a method, URL, headers, and sometimes a body. The roadmap page sends a `GET` request to `/api/v1/roadmaps` with an `Accept: application/json` header. `GET` communicates that the caller is reading data rather than changing it.

The response has a status, headers, and body. A status in the 200 range is only the first check: the client must still verify that the body is valid JSON with the expected shape. A 400, 404, or 500 response reached a server; a network failure means the browser did not obtain an HTTP response at all.

## REST API contracts

An API contract is the shared agreement about paths, methods, status codes, and data. The Java API promises fields such as `id`, `title`, `estimatedWeeks`, and `stages`. React promises to interpret only data matching that structure.

Changing a field name on only one side breaks the agreement even if both projects compile independently. Contract tests and live full-stack tests catch different kinds of drift.

## JSON serialization

Spring converts Java records into JSON. For example, Java's `estimatedWeeks()` record component becomes the JSON property `estimatedWeeks`. The browser parses that JSON into JavaScript values.

JSON contains values, not Java or TypeScript types. It cannot carry a Java record declaration or a TypeScript interface. That is why the client treats parsed JSON as `unknown` until runtime checks succeed.

## TypeScript DTOs and Java records

`RoadmapResponse` exists twice for two different compilers:

- The Java record describes what Spring returns and gives Java compile-time safety.
- The TypeScript interface describes what React expects and gives frontend compile-time safety.

Neither definition automatically verifies the other. `roadmaps.ts` supplies the runtime bridge by checking every field and nested array. A future OpenAPI workflow could generate one side from a shared machine-readable contract, but generation is unnecessary for this small milestone.

## Frontend API clients

A small API client centralizes details that components should not repeat:

- resource paths;
- JSON parsing;
- runtime validation;
- status-to-error mapping;
- network failures;
- cancellation.

The component receives typed data or a typed error and stays focused on display behavior. Native `fetch` is enough here; adding an HTTP library would add dependency and configuration cost without solving a current need.

## Vite development proxy

The React development server and Spring Boot normally use different ports. Browsers treat those ports as different origins. Vite's proxy receives `/api` requests on the frontend origin and forwards them server-side to Spring Boot.

This avoids a permissive development CORS policy and lets source code use stable relative URLs. The proxy exists only while Vite's development server is running. A successful production build does not create a production reverse proxy.

## Loading and error states

Network work takes time and can fail, so the UI must represent more than “data exists.” The roadmap component uses a discriminated union:

- `loading` while work is pending;
- `success` with a roadmap or `null` for an empty catalog result;
- `error` with a user-facing message.

These states prevent impossible combinations such as showing a spinner, old error, and successful roadmap simultaneously. Retry starts a fresh request. The static certification guides remain visible, but they are labeled as static and never claimed as a successful API response.

## `useEffect` and cancellation

Rendering should remain pure. `useEffect` starts the request after React commits the component. The effect creates an `AbortController` and passes its signal through the API client to `fetch`.

The cleanup function calls `abort()`. Cleanup matters when the user navigates away, dependencies change, or React intentionally replays effects in development. Without cancellation, an obsolete request could consume resources or attempt to update state after it is no longer relevant.

Cancellation is not a visible failure. The API client reports it explicitly as `aborted`, and the component ignores only that expected kind.

## Unit, component, and integration tests

API client unit tests replace `fetch` and test protocol interpretation. Component tests replace the API client and test visible React states. Playwright tests the application in a real browser and verifies the route, rendered response, and proxy-capable request path.

A deterministic Playwright test uses a mocked HTTP response so normal CI does not require Java. A separate `LIVE_API=1` run starts both applications and proves the actual Vite proxy and Spring endpoint agree.

No single level replaces the others. A client unit test cannot prove routing works, and a browser happy-path test is too slow and indirect to cover every malformed response.

## Why a frontend build is not backend verification

Vite bundles files without calling the running API. TypeScript verifies the declared interface, not a live Java response. Therefore a green frontend build can coexist with a stopped backend, incorrect proxy target, changed JSON field, or HTTP 500.

Full-stack verification requires both processes and an actual request through the browser-facing `/api` path.

## Exercises

1. Change one mocked `estimatedWeeks` value from a number to a string and observe the malformed-response test. Restore it afterward.
2. Add a test for an HTTP 503 response and decide whether the existing `server` category is sufficiently precise.
3. Add a second stage to the component fixture and assert its sequence and outcomes render in order.
4. Temporarily stop Spring Boot, open the roadmap page, and explain why the existing static guides remain while the API section shows an error.
5. Start Spring Boot on port 18080 and configure Vite with `ROADMAP_API_PORT`. Use the browser Network panel to find the original `/api` request.
6. Add a deliberate delay to a mocked API promise, navigate away, and verify cancellation does not render an error.
7. Draw the request path from React through Vite, Spring's controller, service, JSON serializer, and back to the component.
8. Propose an OpenAPI schema for `RoadmapResponse`, then list which current handwritten checks it could generate.
