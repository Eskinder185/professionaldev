# Selective CareerOS commit manifest

Prepared from HEAD `5b67a16fbd804e6860904ab94ae40425249b0e94` in an isolated directory. This is a **proposal**, not a staged index or commit. The original worktree and its earlier user changes remain intact.

## Exact contents

The candidate consists of the HEAD tree plus the paths below. `A` adds, `M` replaces the HEAD file with the reviewed candidate bytes, and `D` removes the stale pnpm lockfile. `Current` means the candidate bytes match the present worktree; `Selective` means reviewed hunks were composed in isolation, preserving other uncommitted content in the worktree. The first twelve SHA-256 characters identify each candidate file; the external machine-readable inventory contains full hashes. The manifest file itself is added as the final row.

| Status | Path | Group | Source | SHA-256 |
| --- | --- | --- | --- | --- |
| `M` | `.github/workflows/deploy.yml` | Toolchain | Selective | `f0335d800283` |
| `M` | `.gitignore` | Toolchain | Current | `9756f247b4b3` |
| `A` | `docs/audits/careeros-accessibility.md` | Audit docs | Selective | `c538d0399b1b` |
| `A` | `docs/audits/careeros-baseline.md` | Audit docs | Selective | `be979a5623a2` |
| `A` | `docs/audits/careeros-defects.md` | Audit docs | Selective | `3c54e5c23dfa` |
| `A` | `docs/audits/careeros-final-review.md` | Audit docs | Selective | `a6833a6cf45f` |
| `A` | `docs/audits/careeros-responsive-audit.md` | Audit docs | Selective | `dad5a0d85875` |
| `A` | `docs/audits/careeros-route-inventory.md` | Audit docs | Selective | `df1d22a79f7b` |
| `A` | `docs/audits/careeros-test-results.md` | Audit docs | Selective | `1874fcf9733d` |
| `A` | `docs/audits/figma-parity-matrix.md` | Audit docs | Selective | `ddacaa01f19c` |
| `A` | `docs/careeros.md` | Product docs | Selective | `881be44d05f2` |
| `A` | `eslint.config.js` | Tests | Current | `2cd924959908` |
| `M` | `index.html` | CareerOS UI | Current | `b2994b9f9177` |
| `M` | `package-lock.json` | Toolchain | Selective | `c5eb768cfb31` |
| `M` | `package.json` | Toolchain | Selective | `938a04b2a377` |
| `A` | `playwright.config.ts` | Tests | Current | `cb9a6983854d` |
| `D` | `pnpm-lock.yaml` | Toolchain | Selective | `—` |
| `M` | `src/App.tsx` | CareerOS UI | Selective | `11d266e2441c` |
| `M` | `src/components/NavBar.tsx` | CareerOS UI | Current | `5827478a6504` |
| `M` | `src/components/backgrounds/BackgroundConstellations.tsx` | Legacy compatibility | Current | `470f6562d545` |
| `M` | `src/components/chat/PDCoach.tsx` | Legacy compatibility | Current | `fb0c21bbcfdc` |
| `M` | `src/components/home/CircularOrbitHero.tsx` | Legacy compatibility | Current | `9f89e6885ef4` |
| `M` | `src/components/home/HomeHero.tsx` | CareerOS UI | Current | `b6adb53ec0e8` |
| `A` | `src/components/layout/WorkspaceShell.tsx` | CareerOS UI | Current | `4cf2b4d0371b` |
| `M` | `src/components/shell/SiteFooter.tsx` | CareerOS UI | Current | `42239c920873` |
| `A` | `src/features/ai/CoachPage.tsx` | CareerOS UI | Current | `ca105c891b74` |
| `A` | `src/features/applications/ApplicationsPage.tsx` | CareerOS UI | Current | `0177f39e0bae` |
| `A` | `src/features/career/AnalyticsPage.tsx` | CareerOS UI | Current | `230c42b3fe5b` |
| `A` | `src/features/dashboard/FocusTasks.tsx` | CareerOS UI | Current | `7ffa1c0f3b9f` |
| `A` | `src/features/interviews/InterviewStudioPage.tsx` | CareerOS UI | Current | `66e344bef2b8` |
| `A` | `src/features/jobs/JobsPage.tsx` | CareerOS UI | Current | `7d089891be9b` |
| `A` | `src/features/learning/AcademyPage.tsx` | CareerOS UI | Current | `6e252bb2d209` |
| `A` | `src/features/resume/ResumeStudioPage.tsx` | CareerOS UI | Current | `294d5fb0ce44` |
| `M` | `src/hooks/useLocal.ts` | Data safety | Current | `f13e5846bf0d` |
| `M` | `src/hooks/useMediaRecorder.ts` | Legacy compatibility | Current | `85c8b70497f6` |
| `A` | `src/hooks/useModalFocus.ts` | UX polish | Current | `1eada383948f` |
| `M` | `src/main.tsx` | CareerOS UI | Selective | `9801ddadb8d4` |
| `M` | `src/pages/AppTracker.tsx` | Legacy compatibility | Current | `32d190469f26` |
| `A` | `src/pages/Dashboard.tsx` | CareerOS UI | Current | `67fd5a08dadf` |
| `M` | `src/pages/InterviewSim.tsx` | Legacy compatibility | Current | `63918f676883` |
| `M` | `src/pages/Resources/CertsLearning.tsx` | Legacy compatibility | Selective | `4d9c22e92751` |
| `M` | `src/pages/Resources/Productivity.tsx` | Legacy compatibility | Selective | `188328d3bec6` |
| `M` | `src/pages/Resources/Trackers.tsx` | UX polish | Current | `97e01ed5bf4b` |
| `M` | `src/pages/Settings.tsx` | Data safety | Current | `6f9723a33b8c` |
| `M` | `src/pages/StarBuilder.tsx` | Legacy compatibility | Current | `3aef8e183361` |
| `A` | `src/styles/careeros-polish.css` | UX polish | Current | `b5db1841dc16` |
| `A` | `src/styles/careeros.css` | CareerOS UI | Current | `49b872fb819d` |
| `M` | `src/styles/tailwind.css` | CareerOS UI | Current | `9f1a95909804` |
| `M` | `src/utils/migrations.ts` | Data safety | Current | `b7bbb9687322` |
| `A` | `src/vite-env.d.ts` | Toolchain | Current | `bd0846e628cc` |
| `A` | `tests/e2e/app.spec.ts` | Tests | Selective | `2f69256b2844` |
| `A` | `tests/e2e/careeros.spec.ts` | Tests | Current | `9628a53fd3ce` |
| `A` | `tests/setup.ts` | Tests | Current | `5cf374f2de86` |
| `A` | `tests/unit/analyzeResume.test.ts` | Tests | Current | `4f34a7520371` |
| `A` | `tests/unit/migrations.test.ts` | Tests | Current | `c5e44cd57838` |
| `A` | `tests/unit/storage.test.ts` | Tests | Current | `0bd1047eef9c` |
| `M` | `tsconfig.json` | Toolchain | Current | `02d70d1fabcf` |
| `A` | `vitest.config.ts` | Tests | Current | `af9c33a0f8ec` |
| `A` | `docs/audits/careeros-selective-commit-manifest.md` | Audit docs | Selective | self |

## Mixed-file decisions

- `src/App.tsx` and `src/main.tsx`: keep CareerOS routes, shell and styles; omit the separate authentication provider and callback route. The original mixed files are unchanged in the worktree.
- `package.json` and `package-lock.json`: include CareerOS test/build dependencies and a regenerated offline lockfile; remove unused `oidc-client-ts` from this candidate. `npm ci --offline` installed the exact lock successfully.
- `.github/workflows/deploy.yml`: only change the existing build job from Node 18 to Node 22. The larger pre-existing workflow rewrite, deployment steps and permissions are excluded.
- `tests/e2e/app.spec.ts`: retain four existing navigation, persistence and STAR PDF tests; omit the API-only roadmap test. The CareerOS spec is included whole.
- `src/pages/Resources/CertsLearning.tsx` and `src/pages/Resources/Productivity.tsx`: include only narrow lint repairs required by the new quality gate. Other uncommitted edits to these files remain outside the candidate.
- `src/pages/StarBuilder.tsx`: include the reviewed PDF export fix because the legacy export test failed with HEAD and passed with this version.
- `docs/careeros.md` and four historical audit reports contain scope notes separating the full worktree audit from this narrower commit. Machine-specific home paths were replaced with `<local-audit-root>` or `<workspace>` in candidate documentation.
- `pnpm-lock.yaml`: delete only in the candidate, consistent with the reviewed npm toolchain and existing unstaged deletion.

## Excluded dirty worktree paths

These existing changes stay in the user worktree and are absent from the candidate. New `apps/api` and architecture/learning documents form separate backend and documentation work; auth/API client/proxy changes are separate integrations. README contains mixed CareerOS, backend and repository history, so it is excluded whole.

```text
M README.md
D src/ADD_TO_App_tsx_ROUTES.txt
D src/index.css
M src/pages/CareerTools/StarTool.tsx
M src/pages/Resources/Roadmaps.tsx
M src/pages/SelfAssessment/CoreValues.tsx
M src/pages/SelfAssessment/StrengthsTest.tsx
M src/utils/storage.ts
M vite.config.ts
D vite.config.ts.example
?? apps/api/.env.example
?? apps/api/.gitattributes
?? apps/api/.gitignore
?? apps/api/.mvn/wrapper/maven-wrapper.properties
?? apps/api/compose.yaml
?? apps/api/mvnw
?? apps/api/mvnw.cmd
?? apps/api/pom.xml
?? apps/api/src/main/java/dev/eskinder/roadmap/RoadmapApplication.java
?? apps/api/src/main/java/dev/eskinder/roadmap/common/error/ApiError.java
?? apps/api/src/main/java/dev/eskinder/roadmap/common/error/GlobalExceptionHandler.java
?? apps/api/src/main/java/dev/eskinder/roadmap/common/error/ValidationError.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressConfiguration.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressConflictException.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressController.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressPrincipalNotFoundException.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressService.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressStatus.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/StageNotFoundException.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/dto/ProgressResponse.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/dto/UpsertProgressRequest.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/persistence/ApplicationUserEntity.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/persistence/ApplicationUserRepository.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/persistence/UserStageProgressEntity.java
?? apps/api/src/main/java/dev/eskinder/roadmap/progress/persistence/UserStageProgressRepository.java
?? apps/api/src/main/java/dev/eskinder/roadmap/roadmap/RoadmapController.java
?? apps/api/src/main/java/dev/eskinder/roadmap/roadmap/RoadmapNotFoundException.java
?? apps/api/src/main/java/dev/eskinder/roadmap/roadmap/RoadmapService.java
?? apps/api/src/main/java/dev/eskinder/roadmap/roadmap/dto/RoadmapResponse.java
?? apps/api/src/main/java/dev/eskinder/roadmap/roadmap/dto/RoadmapStageResponse.java
?? apps/api/src/main/java/dev/eskinder/roadmap/roadmap/persistence/RoadmapEntity.java
?? apps/api/src/main/java/dev/eskinder/roadmap/roadmap/persistence/RoadmapRepository.java
?? apps/api/src/main/java/dev/eskinder/roadmap/roadmap/persistence/RoadmapStageEntity.java
?? apps/api/src/main/java/dev/eskinder/roadmap/roadmap/persistence/RoadmapStageRepository.java
?? apps/api/src/main/java/dev/eskinder/roadmap/roadmap/persistence/StageOutcomeEntity.java
?? apps/api/src/main/java/dev/eskinder/roadmap/security/ApiAccessDeniedHandler.java
?? apps/api/src/main/java/dev/eskinder/roadmap/security/ApiAuthenticationEntryPoint.java
?? apps/api/src/main/java/dev/eskinder/roadmap/security/AuthenticatedIdentity.java
?? apps/api/src/main/java/dev/eskinder/roadmap/security/CurrentIdentityResolver.java
?? apps/api/src/main/java/dev/eskinder/roadmap/security/LocalBasicAuthenticationEntryPoint.java
?? apps/api/src/main/java/dev/eskinder/roadmap/security/OidcSecurityConfiguration.java
?? apps/api/src/main/java/dev/eskinder/roadmap/security/SecurityConfiguration.java
?? apps/api/src/main/java/dev/eskinder/roadmap/security/SecurityErrorWriter.java
?? apps/api/src/main/resources/application.yml
?? apps/api/src/main/resources/db/migration/V1__create_roadmap_schema.sql
?? apps/api/src/main/resources/db/migration/V2__seed_roadmap_catalog.sql
?? apps/api/src/main/resources/db/migration/V3__create_user_progress.sql
?? apps/api/src/main/resources/db/migration/V4__scope_users_by_oidc_issuer.sql
?? apps/api/src/test/java/dev/eskinder/roadmap/RoadmapApplicationTests.java
?? apps/api/src/test/java/dev/eskinder/roadmap/progress/ProgressControllerTest.java
?? apps/api/src/test/java/dev/eskinder/roadmap/progress/ProgressPersistenceIntegrationTest.java
?? apps/api/src/test/java/dev/eskinder/roadmap/roadmap/RoadmapControllerTest.java
?? apps/api/src/test/java/dev/eskinder/roadmap/roadmap/RoadmapPersistenceIntegrationTest.java
?? apps/api/src/test/java/dev/eskinder/roadmap/roadmap/RoadmapServiceTest.java
?? apps/api/src/test/java/dev/eskinder/roadmap/security/LocalBasicSecurityTest.java
?? apps/api/src/test/java/dev/eskinder/roadmap/support/OidcTestIssuer.java
?? apps/api/src/test/java/dev/eskinder/roadmap/support/PostgresIntegrationTest.java
?? debug.log
?? docs/architecture/browser-storage.md
?? docs/architecture/cleanup-report.md
?? docs/architecture/database-design.md
?? docs/architecture/frontend-backend-integration.md
?? docs/architecture/migration-roadmap.md
?? docs/architecture/progress-and-auth-design.md
?? docs/architecture/repository-audit.md
?? docs/architecture/repository-identity.md
?? docs/architecture/spring-boot-foundation.md
?? docs/learning/java-spring-boot-basics.md
?? docs/learning/learning-log.md
?? docs/learning/learning-roadmap.md
?? docs/learning/postgresql-jpa-flyway.md
?? docs/learning/rest-api-integration.md
?? docs/learning/spring-security-transactions.md
?? src/auth/AuthCallback.tsx
?? src/auth/AuthProvider.tsx
?? src/auth/oidc.ts
?? src/lib/api/http.ts
?? src/lib/api/roadmaps.ts
?? src/lib/api/types.ts
?? tests/unit/Roadmaps.test.tsx
?? tests/unit/roadmaps-api.test.ts
```

Generated `node_modules/`, `dist/`, `test-results/`, API `target/`, screenshots, recovery archives and temporary debug logs are excluded. No populated `.env`, key, token or credential file is selected. A credential-pattern scan flagged only the workflow key `id-token: write`, which is a GitHub permission name, not a secret value.

## Isolated verification

- Candidate built from `git archive HEAD`, then only the listed file bytes were overlaid or composed. `npm install --package-lock-only --offline --ignore-scripts` pruned the lockfile; `npm ci --offline` installed 573 packages with zero reported vulnerabilities.
- `npm run lint`: pass with two warnings inherited from unchanged HEAD legacy pages.
- `npm run typecheck`: pass.
- `npx vitest run --configLoader runner`: 8/8 tests passed in 3 files.
- `npx vite build --configLoader runner`: pass; large optional résumé parser chunk warning remains.
- `npx playwright test --workers=2`: 36/36 desktop/mobile tests passed, including the legacy STAR PDF export.
- Direct route sweep: 43 concrete routes at 390px and 1440px; 86/86 loads, no uncaught errors or page overflow.
- Vite/Vitest default config loading is blocked by the workstation sandbox before source evaluation; the runner loader was used. The `404.html` fallback copy was checked separately.

## Recommended commit message

`feat(careeros): add local-first workspace and verified UX polish`

This single commit covers the exact combined candidate verified above. An optional two-commit split would use `feat(careeros): add local-first career workspace` for code, tests and toolchain, then `docs(careeros): record visual, responsive and accessibility audit` for the audit reports and this manifest. The first split commit would need independent validation; only the combined tree has been verified. No files have been staged, committed, pushed or deployed.

Approval request: approve this exact combined file set and the selective mixed-file hunks before any staging or `git commit`. The external `candidate-files.json` and `candidate.patch` are review artifacts and are not proposed for the repository.
