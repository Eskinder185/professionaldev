# Spring Boot API Foundation

> Historical note: this document describes the Milestone 3 in-memory foundation. Milestone 5 replaces that in-memory collection with PostgreSQL while preserving the same DTO and endpoint contract. See `database-design.md` for the current persistence architecture.

## Purpose and scope

Milestone 3 adds a small read-only Java API alongside the existing React application. The React source remains at the repository root, its browser storage is untouched, and no frontend request has been redirected to the API yet.

The backend is intentionally a single Spring Boot application with one feature-oriented package. Data is held in an immutable in-memory collection. There is no database, authentication, Docker configuration, or deployment change in this milestone.

## Version choice

- Java: 17 LTS (tested with Eclipse Temurin 17.0.16)
- Spring Boot: 4.1.1
- Maven Wrapper: 3.3.4, configured for Maven 3.10.0

Spring Boot 4.1.1 was the latest stable release when this foundation was created. Its official system requirements specify Java 17 or newer and Maven 3.6.3 or newer. Java 17 is the conservative LTS choice because it is both Spring Boot's supported baseline and already installed on the development workstation.

References:

- <https://spring.io/projects/spring-boot>
- <https://docs.spring.io/spring-boot/system-requirements.html>

## Package structure

```text
apps/api/
|-- .mvn/wrapper/maven-wrapper.properties
|-- mvnw
|-- mvnw.cmd
|-- pom.xml
`-- src/
    |-- main/
    |   |-- java/dev/eskinder/roadmap/
    |   |   |-- RoadmapApplication.java
    |   |   |-- common/error/
    |   |   |   |-- ApiError.java
    |   |   |   |-- GlobalExceptionHandler.java
    |   |   |   `-- ValidationError.java
    |   |   `-- roadmap/
    |   |       |-- RoadmapController.java
    |   |       |-- RoadmapNotFoundException.java
    |   |       |-- RoadmapService.java
    |   |       `-- dto/
    |   |           |-- RoadmapResponse.java
    |   |           `-- RoadmapStageResponse.java
    |   `-- resources/application.yml
    `-- test/java/dev/eskinder/roadmap/
        |-- RoadmapApplicationTests.java
        `-- roadmap/
            |-- RoadmapControllerTest.java
            `-- RoadmapServiceTest.java
```

Packages are organized first by feature (`roadmap`) and then by narrowly shared infrastructure (`common/error`). There is one concrete service rather than an interface with only one implementation. No repository abstraction exists because there is no persistence layer yet.

## HTTP API

### List roadmaps

`GET /api/v1/roadmaps` returns HTTP 200 and an array of roadmap DTOs.

```json
[
  {
    "id": "java-spring-backend",
    "title": "Java and Spring Backend",
    "description": "Progress from Java language fundamentals to a tested Spring Boot REST API.",
    "targetRole": "Backend Java Developer",
    "estimatedWeeks": 14,
    "stages": [
      {
        "sequence": 1,
        "title": "Modern Java",
        "outcomes": [
          "Model data with classes and records",
          "Use collections and exceptions"
        ]
      }
    ]
  }
]
```

The real collection contains three roadmaps: AWS Solutions Architect - Associate, CompTIA Security+, and Java and Spring Backend. The first two reflect the certification-roadmap content already present in React.

### Get one roadmap

`GET /api/v1/roadmaps/{id}` returns HTTP 200 when the ID exists. IDs must be lowercase URL slugs containing letters, digits, and single hyphen-separated segments.

An unknown valid ID returns HTTP 404:

```json
{
  "timestamp": "2026-10-23T21:00:00Z",
  "status": 404,
  "error": "Not Found",
  "code": "ROADMAP_NOT_FOUND",
  "message": "Roadmap 'missing-roadmap' was not found",
  "path": "/api/v1/roadmaps/missing-roadmap",
  "violations": []
}
```

An invalid ID such as `INVALID_ID` returns HTTP 400 with code `VALIDATION_FAILED` and a populated `violations` array. `GlobalExceptionHandler` owns both error shapes so controllers do not repeat response-building logic.

### Health

`GET /actuator/health` returns the Actuator health status. Only `health` and `info` are exposed over HTTP, and health details are not disclosed.

## Request flow

1. `RoadmapController` maps HTTP paths and validates the path variable.
2. Spring injects `RoadmapService` through its constructor.
3. `RoadmapService` reads immutable in-memory DTOs and applies lookup behavior.
4. Spring serializes records to JSON.
5. A domain exception or validation failure is converted to a stable `ApiError` by `GlobalExceptionHandler`.

This boundary keeps HTTP concerns out of business logic without creating speculative interfaces or generic layers.

## Local React integration design

During local development, prefer a Vite proxy. It keeps React code on same-origin-looking `/api` URLs and avoids enabling broad CORS rules solely for development.

A future `vite.config.ts` addition can merge this server setting into the existing configuration:

```ts
server: {
  proxy: {
    "/api": {
      target: "http://localhost:8080",
      changeOrigin: true,
    },
  },
},
```

React can then call:

```ts
const response = await fetch("/api/v1/roadmaps");
```

This milestone does not add that proxy or fetch call. In production, a hosting layer should preferably route `/api` to the backend under the same origin. If separate origins are required later, add an explicit Spring CORS allowlist for known frontend origins; do not use a wildcard with credentials.

## Running and verifying locally

The workstation's default `java` command currently resolves to Java 11, so select Java 17 in each new PowerShell session:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
Set-Location apps/api
.\mvnw.cmd test
.\mvnw.cmd package
.\mvnw.cmd spring-boot:run
```

Then try:

```powershell
Invoke-RestMethod http://localhost:8080/api/v1/roadmaps
Invoke-RestMethod http://localhost:8080/api/v1/roadmaps/java-spring-backend
Invoke-RestMethod http://localhost:8080/actuator/health
```

## Deferred decisions

- Persistence and database migrations belong in a later milestone after the API contract is exercised.
- Authentication and authorization should be added when user-specific or write operations exist.
- React should retain its browser data until an explicit, reversible migration and reconciliation strategy is designed.
- Deployment topology, production CORS, observability beyond basic health, and generated API documentation remain open.
