# CareerOS baseline — 2026-11-09

## Recovery and Git state

- Branch: `main`; baseline HEAD: `5b67a16fbd804e6860904ab94ae40425249b0e94`.
- The worktree already contained substantial uncommitted CareerOS and other project work. No staged changes existed. The initial inventory contained 133 modified or untracked project files and four tracked deletions. No files were treated as agent-owned merely because they were uncommitted.
- Ignored build and dependency directories included `apps/api/target/`, `dist/`, `node_modules/`, and `test-results/`. They were excluded from the recovery archive. No environment secrets were copied.
- Local recovery archive: `C:\Users\eskew\.codex\visualizations\2026\11\09\01a1c233-070f-7b80-95fa-714b3d1d8c30\recovery\professionaldev-baseline-20261109T220822Z.zip`. The adjacent JSON manifest records SHA-256 values, paths, branch, and HEAD. It includes a tracked patch and staged patch (empty).
- Verification: every archived file hash matched its source; a separate restore rehearsal applied the archive over a clean export of baseline HEAD, removed the four recorded deletions, and byte-compared all 133 files successfully. Restore into a **separate directory** at the baseline HEAD, overlay the archive's `files/` tree, then remove paths listed in the manifest's deleted section. Do not overwrite the active worktree to rehearse recovery.

## Existing application

The pre-edit app had a React/TypeScript/Vite/Tailwind shell, lazy React Router pages, local storage, a legacy application tracker, self-assessment and career tools, three Academy lessons, résumé versions and local analysis, interview practice, a rule-based coach, and a local roadmap API integration. `docs/careeros.md` describes the implementation and its service limits. A live job provider, generative AI provider, cloud sync, and DOCX export were absent.

## Executed baseline checks

| Command | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test` | Failed during Vitest configuration loading: esbuild could not read parent directory (`Access is denied`) |
| `npm run build` | Failed during Vite configuration loading with the same sandbox directory access error |
| `npx vitest run --configLoader runner` | Passed: 5 files, 20 tests |
| `npx vite build --configLoader runner` | Passed: 2,334 modules; large PDF extraction chunk warning |
| `npx playwright test --workers=2` | Passed: 24 desktop/mobile tests against local preview |

The standard Vite/Vitest failures occur before source compilation. The runner loader succeeds with the same source and installed dependencies. The normal scripts were preserved. Local preview was served at `http://127.0.0.1:4173/professionaldev/`; no production deployment was changed.
The optional local Spring Boot roadmap API was not running during the route sweep; the roadmap screen displayed its designed unavailable state and the preview proxy logged connection refusals. Browser tests use a mocked roadmap response.

## Initial confirmed defects

Settings export omitted `appTracker:items` and raw non-JSON preferences; reset did not clear the application tracker. Job removal had no confirmation and saved jobs could not be edited. The top-bar quick create only navigated to Applications. Mobile job details and controls were cumbersome, small-screen CTAs clipped, and several controls were below 44px. Interview state changes could occur during recording. A decorative notification control implied a notification service that did not exist. See [defect register](careeros-defects.md).

## Constraints

The Figma Starter tool-call limit had already been reached in the preceding design session. This pass used previously verified frame names/dimensions and the available CareerOS design documentation; no fresh Figma inspection is claimed. The sandbox blocks Vite's default configuration loader. No field performance data or Lighthouse run was available.
