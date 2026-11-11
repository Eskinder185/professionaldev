# Cleanup Report

Audit date: 2026-10-23

## Safety method

Each candidate was checked against static imports, dynamic-import syntax, routes, package scripts, Vite/Tailwind/PostCSS configuration, the GitHub Actions workflow, documentation, and repository-wide text references. Public URL exposure cannot be proven from source alone, so root-hosted artifacts and historical routes remain when ownership is uncertain.

## A. Verified safe to remove

| Item | Evidence | Action |
| --- | --- | --- |
| `src/ADD_TO_App_tsx_ROUTES.txt` | Not imported or consumed by scripts; contains obsolete copy/paste instructions and a nonexistent `ResumeLinkedIn` symbol | Removed |
| `src/index.css` | No code import; active entry imports `src/styles/tailwind.css`; README was the only reference | Removed and README corrected |
| `vite.config.ts.example` | No script reference; duplicates the active configuration without adding a selectable environment | Removed |
| `dayjs` | No source/config/script reference | Removed with npm |
| `idb-keyval` | No source/config/script reference; IndexedDB code uses the browser API directly | Removed with npm |
| `papaparse` | No source/config/script reference | Removed with npm |
| `recharts` | No source/config/script reference | Removed with npm |

npm was selected because the workflow uses `npm ci`, `package-lock.json` is synchronized with `package.json`, and every documented command uses npm. `pnpm-lock.yaml` was removed so automated installs have one authoritative dependency graph.

## B. Refactor or consolidate

| Area | Current issue | Recommended change |
| --- | --- | --- |
| Routing | 34 eager routes in `App.tsx` | Add lazy route modules by feature after tests exist |
| Cards | Three overlapping card abstractions | Select one active primitive family, migrate consumers, then delete superseded files |
| Badges | Root and `ui` implementations | Compare rendered variants and converge on one accessible component |
| Shell | Active `NavBar`/`SiteFooter` plus alternate `AppHeader`/`Footer` | Preserve active shell; manually review old shell before deletion |
| Backgrounds | Multiple independent background systems | Choose based on performance and intended design; remove the losing systems and their exclusive packages |
| Storage | Keys and parsing spread across features | Introduce versioned schemas and feature storage adapters |
| Large pages | UI, persistence, export, and domain logic are mixed | Split by feature into components, services, and pure tested functions |
| Routes | Case variants and two naming conventions | Define canonical lowercase paths and explicit compatibility redirects |
| Deployment | Two deploy mechanisms and duplicate 404 copy | Choose Pages Actions as the documented default; retain `gh-pages` only if intentionally used |
| Documentation | Root docs mix product copy and setup notes | Rewrite README after the package manager and deployment URL are confirmed |

## C. Keep

- Active React application and existing visual design.
- `src/styles/tailwind.css`, Tailwind configuration, and active theme provider.
- All routed pages until behavior is covered by tests and route usage is reviewed.
- Resume extraction and analysis utilities and their used dependencies.
- Local-storage and IndexedDB user data. Code may migrate it, but cleanup must never delete it casually.
- GitHub Actions deployment configuration while the public site depends on it.
- Root `404.html` until direct-link behavior and Pages configuration are tested.
- `vite.svg` until public asset usage/history is manually checked; it is unreferenced by source but root-hosted files can have external URLs.
- Git history, ignored build output, and all user-authored content.

## D. Requires manual review

### Unreachable source files

Static import tracing found these files outside the active entry-point graph:

```text
src/components/AnimatedBackground.tsx
src/components/AppHeader.tsx
src/components/Background3D.tsx
src/components/backgrounds/BackgroundBlueprint.tsx
src/components/backgrounds/BackgroundConstellations.tsx
src/components/backgrounds/BackgroundRoadmap.tsx
src/components/backgrounds/BackgroundRouter.tsx
src/components/backgrounds/BackgroundSineWaves.tsx
src/components/Badge.tsx
src/components/Card.tsx
src/components/ClientOnly.tsx
src/components/FeatureSection.tsx
src/components/Footer.tsx
src/components/home/CircularOrbitHero.tsx
src/components/home/RoadmapPath.tsx
src/components/home/ThreeTrackHero.tsx
src/components/Page.tsx
src/components/QuoteWidget.tsx
src/components/R3FScene.tsx
src/components/ui/Badge.tsx
src/components/ui/Button.tsx
src/components/ui/Card.tsx
src/components/ui/HubCard.tsx
src/components/ui/motion.ts
src/components/ui/MotionTile.tsx
src/components/ui/Tile.tsx
src/data/resources/certs.ts
src/pages/Resources/CertsLearning.tsx
src/theme/designSystem.ts
src/theme/index.ts
src/theme/tokens.ts
```

These were not deleted because some reference one another, represent plausible future UI variants, or may document design intent. Review them in small visual groups. A successful build after deletion would not prove that an intended design or unpublished feature was not lost.

### Package and deployment decisions

- npm is now authoritative and `pnpm-lock.yaml` has been removed. Reintroducing pnpm requires an explicit team decision and matching CI/documentation changes.
- Decide whether `@react-three/drei`, `@react-three/fiber`, and the alternate 3D components are intentional.
- Confirm whether this application is intended to remain at the GitHub Pages URL, replace the distinct portfolio currently at `eskinder.dev`, or be mounted below that domain; then decide whether `/professionaldev/` is the correct base.
- Test root and nested direct URLs before changing `BrowserRouter`, Vite `base`, or 404 handling.
- Confirm whether old mixed-case resource URLs have inbound links before replacing them with redirects or removing aliases.

## Changes performed

- Removed three non-runtime obsolete files listed in section A.
- Corrected the README stylesheet troubleshooting path.
- Added architecture, cleanup, migration, and learning documentation.
- Did not delete source features, user data, environment files, tests, deployment configuration, or assets. Dependency and lockfile cleanup was limited to the verified items documented above.

## Milestone 2 stabilization update

Completed on 2026-10-23:

- Removed the four source-unreferenced dependencies after npm was selected.
- Removed the competing pnpm lockfile.
- Preserved all 31 source files outside the active import graph because intent is still uncertain.
- Added ESLint, Vitest, React Testing Library support, jsdom, and Playwright as development tooling.
- Updated vulnerable dependencies within declared version ranges and upgraded jsPDF to patched 4.2.x after adding a browser PDF-download test.
- Replaced ignored bare dynamic PDF imports with typed, bundle-aware dynamic imports.
- Reduced a fresh npm audit from 22 advisories (including one critical) to five moderate advisories.

Remaining audit findings require breaking upgrades:

- React Router 7 addresses the remaining router advisories. The current application is client-only and does not use React Router SSR hydration, but untrusted redirect paths should still be avoided until migration.
- Tailwind CSS 4 addresses the remaining `postcss-selector-parser` advisory. Tailwind 4 is a migration, not a safe lockfile-only update.

Do not use `npm audit fix --force`; plan and test those framework upgrades separately.

## Reversibility

All changes are ordinary Git worktree changes. Review them with `git diff` and restore individual files from Git if needed. No force operation, history rewrite, deployment, or push was performed.
