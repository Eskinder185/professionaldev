# Learning Log

## 2026-10-23 — Milestone 1 repository discovery

### WHAT

Audited the tracked repository, current framework, route table, dependencies, storage behavior, build/deployment configuration, tests, environment references, and Git state. Added architecture, cleanup, migration, and learning documentation. Removed three obsolete non-runtime artifacts.

### WHY

A migration is safer when the existing system is understood and reproducible. The audit establishes evidence for what must be preserved and identifies the quality gates needed before adding more applications.

### WHERE

- `docs/architecture/repository-audit.md`
- `docs/architecture/cleanup-report.md`
- `docs/architecture/migration-roadmap.md`
- `docs/learning/learning-roadmap.md`
- `README.md`

### HOW

The current entry point is `src/main.tsx`, which mounts React, establishes the router and theme provider, runs a storage migration, and imports global CSS. `src/App.tsx` eagerly imports all active route pages. The build uses Vite to produce static files for GitHub Pages.

Static import tracing was used as one signal for unreachable source. It was combined with route, script, configuration, and repository-wide reference checks. Potentially meaningful feature clusters were documented instead of deleted.

### TEST

- `npm.cmd run build` passed on Node 22.18.0.
- `npx.cmd tsc --noEmit` ran and reported the pre-existing errors documented in the audit.
- `npm.cmd ls --depth=0` confirmed the installed top-level dependency set.
- `npm.cmd audit --offline --omit=dev` reported no known production vulnerabilities from local audit data.
- No unit, component, lint, or end-to-end suite exists yet.

### LEARN

- A build tool can transpile TypeScript without enforcing all type errors; type-checking needs its own command or must be composed into the build/CI pipeline.
- A lockfile makes dependency resolution repeatable, but competing lockfiles make the authoritative package manager ambiguous.
- “Not imported” is evidence that code is inactive, not proof that it has no product value. Safe cleanup includes an ownership and intent decision.
- Browser storage is user data. Migrations need versions, narrow transformations, tests, and idempotence rather than unconditional deletion on each startup.

## Next learning entry

Begin Milestone 3 with one small Spring Boot endpoint only after reviewing the stabilization changes and exercises below.

## 2026-10-23 — Milestone 2 repository stabilization

### WHAT

Fixed all four TypeScript errors, replaced destructive startup storage cleanup, selected npm, removed four unused runtime dependencies, added lint/unit/browser testing, updated CI to Node 22, lazy-loaded routes, repaired production PDF imports, and applied safe dependency security updates.

### WHY

Future applications should be added to a repository with a trustworthy feedback loop. Type checking catches invalid contracts, tests protect behavior, migrations protect user data, CI makes results reproducible, and lazy loading prevents rarely visited tools from delaying the first page.

### WHERE

- Type fixes: `PDCoach.tsx`, `InterviewSim.tsx`, `vite-env.d.ts`
- Data protection: `src/utils/migrations.ts`, `docs/architecture/browser-storage.md`
- Tests: `tests/unit`, `tests/e2e`, `vitest.config.ts`, `playwright.config.ts`
- Quality tooling: `eslint.config.js`, `package.json`, `tsconfig.json`
- Performance: `src/App.tsx`
- CI: `.github/workflows/deploy.yml`
- Identity: `docs/architecture/repository-identity.md`

### HOW

#### 1. Why the TypeScript errors occurred

- Array spreading widened literal message roles to `string`; explicitly typed `Msg` values preserve the union.
- `ImportMeta.env` is supplied by Vite ambient declarations; `vite-env.d.ts` makes those declarations visible to TypeScript.
- `InterviewSim` passed a filename to a recorder `stop` function whose contract has no parameters; the caller now follows the hook API.

Exercise: define a union such as `type Status = "idle" | "done"`, place object literals into a spread array, and inspect when inference widens the property to `string`.

#### 2. TypeScript checking versus Vite compilation

Vite transforms TypeScript quickly for the browser but does not perform the repository's full semantic type-check. That is why the old production build passed while `tsc --noEmit` failed. Both commands now run in CI.

Exercise: create a temporary type mismatch that produces valid JavaScript, compare `npm run build` with `npm run typecheck`, then revert the mismatch.

#### 3. Browser storage migrations

A migration reads a stored schema version, applies each missing transformation once, creates a recovery copy before destructive work, and advances the version only after success. Version 1 preserves original values and snapshots the key families older code deleted.

Exercise: design version 2 on paper to rename one fictional key. Write the backup, failure, and repeated-run test cases before writing migration code.

#### 4. Why automated tests matter

Unit tests give fast feedback for pure logic and storage behavior. Browser tests verify integrations that simulated DOM tests cannot fully prove, including responsive navigation, reload persistence, lazy routes, and file downloads.

Exercise: add a resume-analysis test for a resume with no email and assert that the suggestion explains what is missing.

#### 5. How GitHub Actions validates pull requests

Every pull request to `main` receives a clean `npm ci` installation followed by lint, type-check, unit tests, production build, and Chromium tests. Pages deployment jobs are skipped for pull requests and keep their permissions at job scope.

Exercise: draw the workflow dependency graph and explain why `build-pages` depends on both `validate` and `e2e`.

#### 6. Route lazy loading and initial loading

`React.lazy` creates separate page chunks. `Suspense` provides a loading state while a requested page downloads. The entry chunk became much smaller, while total JavaScript did not disappear and grew after the formerly broken PDF dependencies were correctly bundled.

Exercise: use the browser Network panel with cache disabled. Load Home, then Career Tools, and identify which JavaScript chunk arrives only after navigation.

### TEST

- ESLint: passed with no warnings.
- TypeScript: passed.
- Vitest: 3 files and 8 tests passed.
- Playwright: 8 desktop/mobile Chromium executions passed.
- Production build: passed.
- PDF export: a real `star-story.pdf` download was observed in desktop and mobile browser tests.
- npm audit: reduced from 22 total advisories to 5 moderate advisories; remaining fixes require breaking framework migrations.

### LEARN

The most important concept is that “green build” is not one command. Compilation, types, static analysis, unit behavior, browser behavior, security review, and deployment reproducibility answer different questions and must remain separate, visible checks.
