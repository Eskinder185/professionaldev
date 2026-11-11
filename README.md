# Roadmap to Role

## CareerOS workspace

The local CareerOS workspace starts at `/professionaldev/dashboard`. It adds a responsive shell, record-based dashboard, personal job library, application board, short lesson academy, résumé and interview studios, analytics, and a rule based career coach. The original homepage and tool routes are preserved. See [the CareerOS implementation and limits](docs/careeros.md) for data handling, design tokens, and service boundaries.

Roadmap to Role is a browser-based career-development workspace for students and career changers. It combines self-assessments, resume and LinkedIn preparation, interview practice, application tracking, and learning resources.

## Repository identity

This repository is `Eskinder185/professionaldev` and builds the **Roadmap to Role** React application published at <https://eskinder185.github.io/professionaldev/>. The separate site at <https://eskinder.dev/> currently identifies itself as a portfolio and is not assumed to be deployed from this repository.

See `docs/architecture/repository-identity.md` for the supporting evidence and remaining GitHub Pages uncertainty.

## Technology

- React 18 and TypeScript
- Vite 7
- React Router 6
- Tailwind CSS 3
- Vitest for unit tests
- Playwright for browser tests
- ESLint for static analysis
- GitHub Actions and GitHub Pages

## Local development

Use Node 22.12 or newer and npm. npm is the authoritative package manager for this repository.

```powershell
npm.cmd ci
npm.cmd run dev
```

Vite prints the local address. The application is configured with the `/professionaldev/` base path.

## Quality checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

Run all four checks in sequence with:

```powershell
npm.cmd run check
```

For browser tests, install Chromium once and then run Playwright:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

## Spring Boot API

The additive Java backend lives in `apps/api`. It uses Java 17, Spring Boot 4.1.1, PostgreSQL 17, Flyway, JPA/Hibernate, and the Maven Wrapper. Start its local database first; the Compose service binds only to `127.0.0.1` and stores data in a named volume:

```powershell
Set-Location apps/api
docker compose up -d
docker compose ps
```

If port `5432` is already occupied, choose another localhost port and use the same
value when starting both Compose and Spring Boot:

```powershell
$env:DB_PORT = '55432'
docker compose up -d --wait
# Keep DB_PORT set in the API terminal before running Maven.
```

The checked-in defaults are development-only. Copy `.env.example` to `.env` to override them locally. Never reuse those sample credentials outside local development.

The API requires two local-only authentication passwords. Set them in the API terminal; do not add them to browser source or commit a populated environment file:

```powershell
$env:LOCAL_LEARNER_PASSWORD = 'choose-a-local-password'
$env:LOCAL_REVIEWER_PASSWORD = 'choose-a-different-local-password'
```

On this workstation, select the installed Java 17 JDK before running the API because the system default is still Java 11:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
Set-Location apps/api
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

The roadmap API is available at `http://localhost:8080/api/v1/roadmaps`, and its health endpoint is `http://localhost:8080/actuator/health`.

Authenticated local progress endpoints are `GET /api/v1/progress` and `PUT /api/v1/progress/roadmaps/{roadmapId}/stages/{stageSequence}`. They use HTTP Basic locally with usernames `learner` and `reviewer`; production identity integration is intentionally deferred.

See `docs/architecture/database-design.md` for the current persistence design and `docs/learning/postgresql-jpa-flyway.md` for the database learning guide.

### Running the integrated roadmap locally

Start the API in one PowerShell terminal using the commands above. In a second terminal, start Vite:

```powershell
Set-Location C:\Users\eskew\github\professionaldev
npm.cmd run dev
```

Vite proxies browser requests from `/api` to `http://127.0.0.1:8080`. If the backend must use another port, give both processes the same port without putting it in browser code:

```powershell
# API terminal
$env:PORT = '18080'
.\mvnw.cmd spring-boot:run

# Frontend terminal
$env:ROADMAP_API_PORT = '18080'
npm.cmd run dev
```

The integrated view is `/professionaldev/resources/roadmaps`. API catalog data is read-only and never writes to localStorage.

## Deployment

`.github/workflows/deploy.yml` validates pull requests and pushes with npm, Node 22, ESLint, TypeScript, Vitest, Playwright, and a production build. Pull requests do not deploy. The existing GitHub Pages deployment remains restricted to non-pull-request workflow runs.

Do not use `npm run deploy` unless branch-based `gh-pages` deployment is intentionally selected instead of the configured Pages Actions workflow.

## Data and privacy

User drafts and progress are stored in browser localStorage and IndexedDB. Resume parsing occurs in the browser. Storage migrations are versioned, preserve data by default, and create a recovery snapshot before any historically destructive key family is considered.

See `docs/architecture/browser-storage.md` for the key inventory and migration rules.
