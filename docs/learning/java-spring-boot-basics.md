# Java and Spring Boot Basics

This guide uses the new `apps/api` project as the example. Read the code in the same order a request travels: controller, service, DTO, and error handler.

## Classes and interfaces

A Java class can hold state and provide implemented behavior. `RoadmapService` is a class: it owns the in-memory roadmaps and implements `findAll` and `findById`.

An interface describes a contract without choosing the implementation. Interfaces are useful when there are genuinely multiple implementations or when a boundary must remain independent of a technology. They are not automatically required for every service. This project has one simple in-memory implementation, so adding `RoadmapServiceInterface` would create ceremony without a current design benefit.

An exception is also a class. `RoadmapNotFoundException` gives a missing roadmap a domain-specific meaning instead of returning `null` and forcing every caller to guess what happened.

## Records and DTOs

A record is a concise Java type for immutable data. Java generates its constructor, accessors, `equals`, `hashCode`, and `toString`.

```java
public record ValidationError(String field, String message) {
}
```

A DTO, or data transfer object, defines data that crosses a boundary. `RoadmapResponse` and `RoadmapStageResponse` define the public JSON response rather than exposing internal mutable objects. Their compact constructors call `List.copyOf`, preventing a caller from changing the nested lists after construction.

Records are not appropriate for every object. A service with behavior and dependencies is clearer as a class. A future database entity will also have persistence concerns that should not leak directly into an API DTO.

## Spring dependency injection

Spring creates objects called beans and supplies their dependencies. `@Service` makes `RoadmapService` a bean, and `@RestController` makes `RoadmapController` a bean. The controller declares what it needs in its constructor:

```java
public RoadmapController(RoadmapService roadmapService) {
    this.roadmapService = roadmapService;
}
```

Spring sees that constructor and injects the service. Constructor injection makes required dependencies explicit, supports immutable fields, and lets tests construct objects without reflection.

`@SpringBootApplication` is the entry point. It enables configuration, component scanning beneath `dev.eskinder.roadmap`, and Spring Boot auto-configuration.

## Controllers and services

A controller translates HTTP into Java calls. It owns routes, path variables, input validation, and response serialization. It should not become the place where business rules accumulate.

A service owns application behavior that should make sense without HTTP. `RoadmapService.findById` decides that a missing roadmap is exceptional. The service neither knows nor cares that the controller maps that exception to HTTP 404.

This separation makes business logic quick to unit test and keeps the HTTP layer focused.

## REST and HTTP status codes

REST models resources through HTTP. Here, the collection is `/api/v1/roadmaps` and an individual resource is `/api/v1/roadmaps/{id}`.

- `GET` reads without changing server state.
- `200 OK` means a roadmap or collection was returned.
- `400 Bad Request` means the supplied ID violated the input contract.
- `404 Not Found` means the ID was valid in shape but no roadmap exists for it.
- `500 Internal Server Error` would mean an unexpected server failure; it should not be used for expected missing data.

The `/api/v1` prefix gives future breaking contracts a clean version boundary. It does not mean every internal code change requires a new API version.

## Maven and dependency management

Maven reads `pom.xml`. The Spring Boot parent manages compatible dependency and plugin versions, so the project declares starters without individually pinning their transitive libraries.

- `spring-boot-starter-webmvc` provides Spring MVC, JSON conversion, and embedded Tomcat.
- `spring-boot-starter-validation` provides Jakarta Bean Validation.
- `spring-boot-starter-actuator` provides operational endpoints such as health.
- The test starters provide JUnit, AssertJ, Spring Test, and web test support.

Use the checked-in Maven Wrapper instead of relying on a globally installed Maven version:

```powershell
.\mvnw.cmd test
.\mvnw.cmd package
```

The wrapper downloads the configured Maven distribution once and gives developers and CI the same build-tool version. Maven's normal lifecycle compiles main code, compiles tests, runs tests, and packages the executable JAR.

## Java unit and controller testing

`RoadmapServiceTest` constructs the service directly. These are fast unit tests because no Spring context is needed. AssertJ expresses expectations about the returned data and exception.

`RoadmapControllerTest` starts the application context and uses `MockMvc`. It sends simulated HTTP requests through Spring MVC without binding a real network port. This verifies JSON, validation, HTTP statuses, and the exception handler together.

`RoadmapApplicationTests.contextLoads` is a smoke test. It catches configuration problems that prevent Spring from starting, but it does not replace behavior-focused tests.

A useful testing pattern is Arrange, Act, Assert:

1. Arrange the service or request.
2. Act by calling a method or performing an HTTP request.
3. Assert the observable result, not private implementation details.

## How React will communicate with Spring Boot

React will eventually use `fetch` (or a small API client built around it) to request JSON from the Spring Boot API. During development, Vite can proxy `/api` to port 8080. The browser calls the Vite origin, Vite forwards the API request, and Spring returns JSON.

The frontend should define a matching TypeScript response type and handle at least loading, success, empty, and error states. It should check `response.ok` before parsing a response as successful data. Browser-stored user work must remain independent until a deliberate migration plan addresses ownership, conflict resolution, offline behavior, and rollback.

## Practical exercises

1. Add a service test that confirms the AWS roadmap has an estimated duration of 12 weeks. Run only `RoadmapServiceTest` with `./mvnw -Dtest=RoadmapServiceTest test` (or `mvnw.cmd` on Windows).
2. Add a fourth in-memory roadmap and update the collection test. Notice which controller assertions need to change and which do not.
3. Add `difficulty` to `RoadmapResponse`. Update every constructor call and add one JSON assertion. This demonstrates compile-time guidance from a typed DTO.
4. Trace a missing ID from `RoadmapController` through `RoadmapService`, `RoadmapNotFoundException`, and `GlobalExceptionHandler`. Write down what each layer knows that the others do not.
5. Add a test for another malformed ID, such as `two--hyphens`, before changing any validation code.
6. Start the API and use `Invoke-RestMethod` to compare a successful response, a 404 response, and `/actuator/health`.
7. On a short-lived practice branch, add the Vite proxy described in the architecture document and display only the roadmap titles. Do not remove or overwrite the existing browser-backed roadmap experience.

## What to study next

Focus on Java collections and streams, exceptions, immutability, annotations, constructor injection, JSON serialization, Bean Validation, JUnit assertions, MockMvc, and the Maven lifecycle. After those are comfortable, study persistence boundaries, database transactions, schema migrations, and API contract documentation before adding a database.
