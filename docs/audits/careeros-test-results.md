# CareerOS test results — 2026-11-09

> Historical audit of the full uncommitted worktree. The selective CareerOS commit excludes the separate auth and Spring Boot roadmap/API changes; see the commit manifest for exact candidate verification.

All commands below were executed in `<workspace>`. The local preview used `http://127.0.0.1:4173/professionaldev/`; tests ran with isolated browser contexts and no real personal records.

| Check | Baseline | Final |
| --- | --- | --- |
| `npm run lint` | Pass | Pass |
| `npm run typecheck` | Pass | Pass |
| `npm run test` | Configuration-loading failure | Same failure |
| `npx vitest run --configLoader runner` | 20/20 pass, 5 files | 20/20 pass, 5 files |
| `npm run build` | Configuration-loading failure | Same failure |
| `npx vite build --configLoader runner` | Pass, 2,334 modules | Pass, 2,336 modules |
| `npx playwright test --workers=2` | 24/24 pass | **38/38 pass** across desktop and mobile Chromium |
| Nine primary screens × viewports/themes | 238 baseline observations: 0 page errors, failed local requests, page overflow | 238 final observations: 0 page errors, failed local requests, page overflow |
| 44 concrete routes × desktop/mobile | Initial sweep found one legacy tracker overflow | Repeated sweep: 88/88 direct loads, 0 page errors, failed local requests, page overflow |

The standard `npm run test` and `npm run build` fail before transforming source: esbuild reports `Cannot read directory "../..": Access is denied` while loading `vitest.config.ts` or `vite.config.ts`. The runner loader passes with the installed dependencies and unchanged configuration. This is a workstation sandbox restriction. The standard build script's GitHub Pages fallback copy was exercised separately with `npx shx cp dist/index.html dist/404.html`; file hashes matched. This checks the local artifact, not the live deployment.

Playwright covers navigation, mobile drawer, sidebar collapse, theme/setting persistence, job creation/edit/delete and tracker link, application status/table/timeline, lesson completion and dashboard metric, résumé versions/TXT import/local review/unsupported type, coach history, denied microphone, interview note persistence, quick-create focus/Escape, backup round trip, and empty/error states. Legacy routes were directly loaded; every legacy interaction was not exhaustively exercised. The local roadmap API was not running during the route sweep, so the page showed its intended API-unavailable state and the preview proxy logged connection refusals. The roadmap browser test uses a mocked response; live backend integration was not verified.

## Performance evidence

The production build reported main JS `419.23 kB` (`107.54 kB` gzip), CSS `98.02 kB` (`17.92 kB` gzip), and résumé file extraction `1,653.09 kB` (`501.19 kB` gzip). The parser now loads only after a file import action; résumé route rendering no longer requests that chunk. The large parser still triggers Vite's 500 kB warning. No Lighthouse run, LCP/CLS measurement, or valid field INP data was available, so no runtime score or field improvement is claimed.

Screenshot artifacts and machine-readable `baseline-results.json`, `final-results.json`, and `route-sweep.json` are in `<local-audit-root>\audit\`.
