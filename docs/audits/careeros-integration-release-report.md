# CareerOS integration and release-readiness report

Prepared 2026-11-10 by the integration owner for this pass. Nothing was committed, merged, pushed or deployed.

## 0. Verdict

**The candidate is tested and green on a clean-room install. It is not declared release-ready.**

Every automated check passes from a fresh `npm ci` (details in sections 6 to 9). What stops "release-ready" is not test failures but review and decision items, listed in section 11: one 381-entry uncommitted change set that nobody has code-reviewed as a whole, a late-landing feature from another agent (in-browser and cloud speech transcription) that was tested but not reviewed, a backend (`apps/api`) and a 3.7 MB model file that need an owner decision, and production dependency advisories.

## 1. Repository state

| Item | Value |
|---|---|
| Branch | `feat/careeros-autoapply-extension` |
| HEAD | `5b67a16` (identical to `origin/main`: 0 commits ahead) |
| Uncommitted | 381 entries: 33 modified, 4 deleted, 344 untracked |
| Local branches | `main`, `careeros/local-first-workspace` (1 commit ahead of main), `careeros/resume-interview-studio` (3 commits ahead), `careeros/resume-studio-3-local-ai` (0 ahead) |
| Remote-only | `origin/gh-pages`, two `backup-old-main*` branches |
| Node / npm | v22.18.0 / 11.6.0 |

**All the work exists only in the working tree.** There is no commit containing it, which is why the recovery snapshots below matter.

### Branch comparison
The worktree is a later evolution of the two feature branches. A content comparison of every file on `careeros/resume-interview-studio` against the worktree found no feature present only on the branch. Four paths exist on a branch but not in the worktree: `src/ADD_TO_App_tsx_ROUTES.txt`, `src/index.css`, `vite.config.ts.example` (deliberately deleted) and `src/features/resume/document/blocks.tsx` (now `blocks.ts`). **Recommendation: do not merge those branches; keep them as history.**

## 2. Recovery snapshots (outside the repository)

| Snapshot | When | Contents | Verified |
|---|---|---|---|
| `C:/Users/eskew/careeros-recovery/20261110-193051` | start of this pass | every modified and untracked file (378), `tracked-changes.patch`, `all-branches.bundle`, `HEAD.txt`, status, `MANIFEST.sha256` | 378 of 378 SHA-256 match, bundle verified |
| `C:/Users/eskew/careeros-recovery/candidate-20261110-202705` | final candidate | 377 files, patch, bundle, manifest | 377 of 377 match, bundle verified |

The 4 deleted files are recoverable from `HEAD` and the bundle. No branch was deleted, reset, cleaned or force-pushed.

A disposable clean-room copy used for verification is at `C:/Users/eskew/careeros-cleanroom` (safe to delete).

## 3. Concurrent-editing hazard (unresolved by design)

At least two other agents edited the same worktree during this pass. I cannot stop another agent, so I did what the process allows:

- Took the snapshot first, then confirmed the tree was quiet for 3 minutes before changing anything.
- At 20:12 the tree **did not compile**: another agent had left `SessionRoom.tsx` mid-edit while adding speech transcription. I did not touch their file, waited until it was quiet for 90 seconds and typechecking recovered, then treated that as the candidate.
- One minimal edit in their file, for lint only: `SessionRoom.tsx:64` read `const [transcriptSource, setTranscriptSource]` but never used `transcriptSource` (the value is already saved on each answer). It is now `const [, setTranscriptSource]`. Behavior is unchanged.

**Recommendation:** name one integration owner and freeze other agents' writes before committing. The candidate is only valid for the state captured in the snapshot, since the tree could keep moving.

Work from other agents that landed during this pass (tested, not reviewed): interview speech transcription (`src/features/interviews/transcription/*`, `audioProcessing.ts`, new unit and e2e specs), extension AI settings and question drafting (`apps/extension/entrypoints/options/ai.tsx`, `AISettingsPanel.tsx`), the Settings and backup rewrite, `taskModels.ts`, and the `@xenova/transformers` dependency.

## 4. Defects found and fixed

| # | Defect | Class | Fix | Regression coverage |
|---|---|---|---|---|
| 1 | **Vitest could not run any test** ("Vitest failed to find the runner") | Environmental; upstream bug | When the shell's working directory has a **lowercase drive letter** (`c:/...`, as in Git Bash and the IDE terminal), Vitest 5 loads two copies of itself. Reproduced in a clean install of the same versions; passes with an uppercase drive letter. `npm test` and `npm run test:watch` now pass `--root .` (verified from both casings). My earlier theory (missing `@vitest/runner`) was wrong: v5 bundles its runner | `npm test` itself |
| 2 | 5 tests failed on `toBeInTheDocument` / `toHaveTextContent` | Real (test setup) | `tests/setup.ts` registers jest-dom matchers on the suite's own `expect` instead of importing `@testing-library/jest-dom/vitest`, which loaded its own Vitest instance | the 5 tests now pass |
| 3 | Lint errors | Real | `TeleprompterRecorder.tsx` unused catch binding; side-panel unused variable and effect-dependency notes; two useless assignments in the shared URL parser; `SessionRoom.tsx` unused state. `taskModels.ts` was already fixed by its owner | `npm run lint` |
| 4 | `npm run lint` did not cover the extension or shared packages | Real (gap) | `eslint.config.js` and the script now include `apps/extension/{entrypoints,src}` and `packages` | `npm run lint` |
| 5 | **Interrupted restore could not be undone** | **Real data-safety defect** | The restore recovery point was in memory only, so a closed tab or crash mid-restore left half-restored data. Now a checksummed recovery journal is written to a separate IndexedDB (never exported, never itself restored) before any record is overwritten. A Web Lock stops another tab from "recovering" during a live restore. On start-up an unfinished journal is rolled back, a tampered journal is ignored, and a finished restore leaves none. Start-up now recovers, then migrates, then renders. A migration failure no longer yields a blank page | `data-safety.spec.ts` (5 tests). I proved the interrupted-restore test fails with the recovery call disabled |
| 6 | Racy tests: restore reloads the page on purpose, and two tests polled the page while it reloaded; one fixture opened the app's IndexedDB with no schema | Test race, not an app bug | Tests wait for the reload; the fixture creates the store as the app does. **Assertions unchanged** | 128 of 128 at 14 workers with 8 repeats |
| 7 | Side-panel tab labels clipped ("Résumé …") after another agent added a 4th tab | Real UI regression | `.tab` text wraps instead of ellipsis | New check in `extension-sidepanel.spec.ts` across 320 to 450 px. Verified it fails on the old CSS and passes on the fix |
| 8 | **CI would have failed**: the e2e job ran `test:e2e` without building the extension the specs load | Real release blocker | `deploy.yml`: added `ext:build` before `test:e2e`, plus `ext:typecheck` and `ext:build` in the validate job | Not runnable here; see section 11 |
| 9 | Build output (`apps/extension/.output`, `dist`), `debug.log` and `.claude/` were not git-ignored | Real hygiene | Added to `.gitignore` | `git status` |
| 10 | The local `node_modules` differed from the lockfile (`npm ci --dry-run` reported 72 removed, 59 changed), so earlier green results did not prove CI parity | Process gap | Re-verified everything in a clean room from a fresh `npm ci` (section 9) | Clean-room run |

### The six reported Playwright failures

All six pass: Settings backup, Storage backup and Denied microphone, each on desktop and mobile. Run serially, then 24 of 24 across repeats at 2 workers.

- **Settings backup (x2) and Storage backup (x2):** stale and in-flight. These specs landed together with the Settings and backup rewrite, which was incomplete when they first ran (the "Export my data" control was missing then). Not a regression in the shipped code. Two latent races in the storage specs were found afterwards (defect 6) and fixed.
- **Denied microphone (x2):** the interviews media code was being edited when it failed. It passes at every concurrency level. **I did not capture the original failure output, so I cannot state its exact cause beyond "code in flux".**

No assertion was weakened.

## 5. Consolidation findings

| Area | State | Notes |
|---|---|---|
| Jobs, Matches | Working | Shared job schema; tested through employer-board mocks |
| Tracker | Working | One store (`appTracker:items`); the review banner reads extension records |
| Documents | Working | Résumé versions and cover letters; edits go through Résumé Studio |
| AutoApply extension | Working | Real unpacked extension; docked and tab-hosted panel verified separately (section 9) |
| AI Connections | Working | Consent gating tested for cover letters; new extension AI settings from another agent are covered by their spec |
| One-Page Résumé Studio | Working | Export, tailoring and version-preservation tests pass |
| Interview Studio | Working | Includes new, unreviewed transcription work |
| Storage and Privacy | Working, hardened | Defect 5 fixed; IndexedDB remains a verified **copy** only |

No duplicated tracker or résumé store was found. Overlapping edits found and resolved: the tracker `Application` type (single definition in `src/features/tracker/model.ts`, re-exported from the old path), and the shell navigation (sidebar replaced by top navigation; its spec updated).

## 6. Local data safety

All tests use Playwright's disposable browser contexts and synthetic fixtures. No real profile was read or cleared.

| Check | Result |
|---|---|
| Existing localStorage preserved | Pass (migration unit tests; legacy-key copy keeps originals) |
| Legacy saved jobs migrated without deleting the originals | Pass |
| IndexedDB copy keeps originals; corrupted copy never replaces records; mirror self-repairs from localStorage | Pass |
| Backup export / checksum verification (tamper rejected) | Pass |
| Restore preview, then restore | Pass |
| Round trip preserves résumé versions, application history, interviews and recorded interview audio | Pass |
| Restore that fails part-way rolls everything back and reports it | Pass |
| **Interrupted restore recovered on next start** | Pass (new) |
| Tampered recovery journal never applied | Pass (new) |
| IndexedDB promoted to authoritative store | **No. Deliberately not done**; localStorage stays authoritative |

## 7. Microphone behavior

`tests/e2e/microphone-matrix.spec.ts`, 5 cases on desktop and mobile, 30 of 30 across repeats. **Every case uses Chromium's synthetic devices or a stubbed `mediaDevices`. No physical microphone was tested, and nothing here proves any specific hardware works.**

| Case | Verified behavior |
|---|---|
| Granted (synthetic) | Mic off until Start answer; no stream opened beforehand |
| Denied | Clear message; text-only interview completes to a report |
| No device | "No microphone was found"; text-only completes |
| Disconnected mid-answer | User told, answer kept, device released (the track `ended` event is dispatched manually because the fake device cannot be unplugged) |
| Stopping an answer | Every track ends; nothing keeps capturing |

The product allows one answer per question, so there is no "discard and re-record" action to test.

## 8. Unit tests, typecheck, lint, builds

| Check | Command | Result |
|---|---|---|
| Unit | `npm test` (native Vitest) | **24 files passed, 1 skipped; 197 tests passed, 2 skipped; 0 failed** |
| Typecheck, website | `npm run typecheck` | 0 errors |
| Typecheck, extension | `npm run ext:typecheck` | 0 errors |
| Lint | `npm run lint` (now includes extension and packages) | 0 errors, 0 warnings |
| Website build | `npm run build` | Succeeds |
| Extension build | `npm run ext:build` | Succeeds |

The 2 skipped unit tests are `tests/unit/resume/reference.test.ts`, which `describe.skipIf` a reference-résumé file that is not in the repo.

## 9. Playwright and clean-room results

**Authoritative result (clean room: fresh `npm ci`, CI mode = 1 worker, 2 retries, run from a lowercase-drive shell):**

| Install | Lint | Typecheck | ext:typecheck | Unit | Web build | Ext build | Playwright |
|---|---|---|---|---|---|---|---|
| clean room | pass | pass | pass | 197 passed, 2 skipped | pass | pass | **261 passed, 91 skipped, 0 unexpected, 0 flaky** |

Concurrency progression on the live tree (earlier runs predate tests added by other agents):

| Run | Workers | Passed | Skipped | Failed |
|---|---|---|---|---|
| Full suite | 1 | 211 | 45 | 0 |
| Full suite | 2 | 211 | 45 | 0 |
| Full suite | 14 (default) | 211 | 45 | 0 |
| Full suite after new tests | 1 | 257 | 91 | 0 |
| Full suite after new tests | 14 | 255 to 256 | 91 | 1 to 2, all the restore/reload race (defect 6) |
| Race fixed, storage and data-safety specs | 14, 8 repeats | 128 | 0 | 0 |

**The 91 skips are intentional**, all in the mobile project (desktop Chromium ran 176 and passed all 176; mobile ran 85 and passed all 85). By spec file: route health 46 (viewport independent, run once on desktop), extension side panel 17 and extension AI settings 1 (the extension runs once, on desktop Chromium), Résumé Studio 9, Jobs workspace 7 (desktop three-pane flows; the mobile job flow and the 375 to 1920 px sweeps are separate tests that do run), Interview Studio 4 and job requirements 4 (viewport sweeps run once), accessibility 2, tracker 1 (drag and drop is a desktop interaction; the status selects cover touch and keyboard). **Consequence: several flows are exercised on desktop Chromium only.**

## 10. Real-browser verification

What was done, in real Chromium:

- **Route sweep:** all 46 routes render with zero uncaught page errors and zero console errors (`route-smoke.spec.ts`; external-network noise filtered). The Roadmaps page logs a proxy error because the optional backend is offline; its failure state has its own passing test.
- **Real unpacked extension** for all extension integration tests.
- **Docked side panel, verified separately from tab-hosted tests.** Earlier extension tests open the panel as an ordinary tab pinned to the application tab (`?tab=`). Here, `chrome.sidePanel.open` was triggered from a trusted click, with no tab pin. Chromium created a real `sidepanel/index.html` panel, which read the live page and showed its job title, company and location. Done in headless and headed Chromium; screenshots in `docs/audits/release-screenshots/`. It also exposed defect 7.
- Search and filtering, tracker, document management, résumé exports, AutoApply integration, local AI consent, microphone permission flow and backup/restore are all covered by the Playwright specs above.

**Not done:**
- No human manual walkthrough; this is automated browser testing.
- No physical microphone or camera.
- No real Ollama or LM Studio (a mock local server and stubbed connections stand in).
- Employer job boards are mocked in tests (the live APIs were confirmed with real requests earlier, but the app was not tested against live boards).
- Not run on GitHub Actions or Linux. Résumé PDF/layout tests depend on font metrics and could differ on a Linux runner.
- The toolbar popup was tested as a page, not clicked from the browser toolbar (Playwright cannot click browser chrome).

## 11. Remaining blockers and risks

Blocking release-ready:

1. **No reviewed commit.** 381 uncommitted entries from several agents, none reviewed as a whole. Needs one integration owner, a commit plan and a review. The `careeros-selective-commit-manifest.md` in `docs/audits` is an earlier attempt and is likely stale.
2. **Unreviewed transcription feature** (browser Whisper, local Whisper, cloud Whisper). A cloud path exists and is gated by a per-session consent checkbox, but I did not audit API-key handling or what leaves the device.
3. **Production dependency advisories** (19 total: 14 moderate, 5 high). Shipped to browsers: `react-router` / `react-router-dom` (moderate, open redirect) and the high-severity chain under the new `@xenova/transformers` (`onnxruntime-web`, `onnx-proto`, `protobufjs`). `sharp` is Node-only. Fixes need breaking upgrades; none was applied.
4. **`apps/api` (Spring Boot roadmap API, 57 files) and `public/models/face_landmarker.task` (3.7 MB binary).** Both need an owner decision. Production on GitHub Pages has no backend, and the Roadmaps page depends on `/api/v1/roadmaps`.
5. **CI unproven.** `deploy.yml` was edited but could not be run here.

Risks to accept or fix:

- Vitest on Windows is **worked around, not fixed upstream** (Linux CI is unaffected).
- `pnpm-lock.yaml` is deleted, leaving `package-lock.json` as the only lockfile. Confirm nobody uses pnpm. Four dependencies were also removed (`dayjs`, `idb-keyval`, `papaparse`, `recharts`); nothing imports them any more.
- Extension toolbar icons are solid-blue placeholders; the extension is unpacked only, with no store packaging reviewed.
- Mobile coverage of desktop-only flows is limited (section 9).

## 12. Rollback

**Before anything is committed (current state):** nothing to roll back in git. To restore the exact tree as it was at the start of this pass:
```
# PowerShell, from C:/Users/eskew/github/professionaldev
Copy-Item -Recurse -Force "C:/Users/eskew/careeros-recovery/20261110-193051/files/*" .
git checkout HEAD -- pnpm-lock.yaml src/ADD_TO_App_tsx_ROUTES.txt src/index.css vite.config.ts.example   # only if you want the 4 deleted files back
```
To restore the final candidate instead, use `candidate-20261110-202705` the same way. The `.bundle` files contain every branch (`git clone <bundle>` to inspect).

**After release:** revert the release commit or merge; for GitHub Pages redeploy the previous `gh-pages` commit; for the extension load the previous unpacked build.

**User data:** the restore journal rolls an interrupted restore back automatically on next start. Migration copies are kept in `pd:migrations:backup:v*` keys. Users can also re-import any exported backup (checksum-verified).

## 13. Files changed by this pass

Configuration and CI: `package.json` (test and lint scripts), `vitest.config.ts` (comment only), `tests/setup.ts`, `eslint.config.js`, `.gitignore`, `.github/workflows/deploy.yml`.
Source: `src/features/storage/backup.ts` (recovery journal), `src/main.tsx` (start-up order), `src/components/Elevator/TeleprompterRecorder.tsx`, `src/features/interviews/SessionRoom.tsx` (one line), `packages/careeros-shared/schemas/index.ts`, `apps/extension/entrypoints/sidepanel/{AutofillTab.tsx,styles.css}`.
Tests added: `tests/e2e/{data-safety,microphone-matrix,route-smoke}.spec.ts`. Tests changed: `storage-backup.spec.ts` (two race fixes), `extension-sidepanel.spec.ts` (clipped-tab check).

---

# Appendix A. Proposed release file list

Status: `A` = new, `M` = modified, `D` = deleted. Generated from `git status` after `.gitignore` was updated, so build output, `dist/`, `debug.log` and `.claude/` are already excluded. **Recommendation: release the INCLUDE groups; decide on OPTIONAL and HOLD first.**

| Group | Files |
|---|---|
| INCLUDE: application source | 145 |
| INCLUDE: AutoApply extension | 40 |
| INCLUDE: build, CI and config | 10 |
| INCLUDE: documentation | 29 |
| INCLUDE: other | 3 |
| INCLUDE: shared package | 4 |
| INCLUDE: tests | 50 |
| OPTIONAL: test evidence screenshots | 42 |
| HOLD: 3.7 MB binary model (confirm license and provenance) | 1 |
| HOLD: Spring Boot roadmap API (needs an owner decision) | 57 |

### INCLUDE: application source (145)

```
D  src/ADD_TO_App_tsx_ROUTES.txt
M  src/App.tsx
M  src/components/Elevator/TeleprompterRecorder.tsx
M  src/components/NavBar.tsx
M  src/components/backgrounds/BackgroundConstellations.tsx
M  src/components/chat/PDCoach.tsx
M  src/components/home/CircularOrbitHero.tsx
M  src/components/home/HomeHero.tsx
M  src/components/shell/SiteFooter.tsx
M  src/hooks/useLocal.ts
M  src/hooks/useMediaRecorder.ts
D  src/index.css
M  src/main.tsx
M  src/pages/AppTracker.tsx
M  src/pages/CareerTools/StarTool.tsx
M  src/pages/InterviewSim.tsx
M  src/pages/Resources/CertsLearning.tsx
M  src/pages/Resources/Productivity.tsx
M  src/pages/Resources/Roadmaps.tsx
M  src/pages/Resources/Trackers.tsx
M  src/pages/SelfAssessment/CoreValues.tsx
M  src/pages/SelfAssessment/StrengthsTest.tsx
M  src/pages/Settings.tsx
M  src/pages/StarBuilder.tsx
M  src/styles/tailwind.css
M  src/utils/migrations.ts
M  src/utils/storage.ts
A  src/auth/AuthCallback.tsx
A  src/auth/AuthProvider.tsx
A  src/auth/oidc.ts
A  src/components/layout/WorkspaceShell.tsx
A  src/features/ai/AIConnectionProvider.tsx
A  src/features/ai/AIConnectionsSection.tsx
A  src/features/ai/CoachPage.tsx
A  src/features/ai/anthropic.ts
A  src/features/ai/client.ts
A  src/features/ai/configStore.ts
A  src/features/ai/connectionState.ts
A  src/features/ai/endpoint.ts
A  src/features/ai/gemini.ts
A  src/features/ai/ollama.ts
A  src/features/ai/providers.ts
A  src/features/ai/structured.ts
A  src/features/ai/taskModels.ts
A  src/features/applications/ApplicationsPage.tsx
A  src/features/autoapply/AutoApplyPage.tsx
A  src/features/autoapply/SyntheticApplicationPage.tsx
A  src/features/autoapply/agentMode.ts
A  src/features/autoapply/analysisSync.ts
A  src/features/autoapply/autoapply.css
A  src/features/autoapply/extensionBridge.ts
A  src/features/autoapply/questionAssistant.ts
A  src/features/autoapply/storage.ts
A  src/features/career/AnalyticsPage.tsx
A  src/features/dashboard/FocusTasks.tsx
A  src/features/documents/CoverLetterEditor.tsx
A  src/features/documents/DocumentsPage.tsx
A  src/features/documents/letters.ts
A  src/features/interviews/InterviewStudioPage.tsx
A  src/features/interviews/SessionReport.tsx
A  src/features/interviews/SessionRoom.tsx
A  src/features/interviews/SetupPanel.tsx
A  src/features/interviews/analysis.ts
A  src/features/interviews/audioMeter.ts
A  src/features/interviews/audioProcessing.ts
A  src/features/interviews/faceTracker.ts
A  src/features/interviews/interview-studio.css
A  src/features/interviews/mediaStore.ts
A  src/features/interviews/model.ts
A  src/features/interviews/presentation.ts
A  src/features/interviews/questions.ts
A  src/features/interviews/speech.ts
A  src/features/interviews/transcription/browserWhisper.ts
A  src/features/interviews/transcription/cloudWhisper.ts
A  src/features/interviews/transcription/index.ts
A  src/features/interviews/transcription/localWhisper.ts
A  src/features/interviews/transcription/types.ts
A  src/features/jobs/JobsPage.tsx
A  src/features/jobs/MatchesPage.tsx
A  src/features/jobs/SuggestedJobs.tsx
A  src/features/jobs/analysis.ts
A  src/features/jobs/components.tsx
A  src/features/jobs/connectors.ts
A  src/features/jobs/dialogs.tsx
A  src/features/jobs/filters.ts
A  src/features/jobs/pipeline.ts
A  src/features/jobs/schema.ts
A  src/features/jobs/store.ts
A  src/features/jobs/text.ts
A  src/features/jobs/useJobWorkspace.ts
A  src/features/jobs/useScores.ts
A  src/features/learning/AcademyPage.tsx
A  src/features/resume/ResumeStudioPage.tsx
A  src/features/resume/ai/AIAssistantPanel.tsx
A  src/features/resume/document/ResumeDocument.tsx
A  src/features/resume/document/blocks.ts
A  src/features/resume/document/exportDocx.ts
A  src/features/resume/document/exportPdf.ts
A  src/features/resume/document/exportText.ts
A  src/features/resume/document/zip.ts
A  src/features/resume/editor/DocumentSettingsPanel.tsx
A  src/features/resume/editor/ResumeEditor.tsx
A  src/features/resume/editor/fields.tsx
A  src/features/resume/fit/FitAssistant.tsx
A  src/features/resume/job/JobRequirementsPanel.tsx
A  src/features/resume/job/MatchPanel.tsx
A  src/features/resume/job/extractRequirements.ts
A  src/features/resume/job/match.ts
A  src/features/resume/job/requirements.ts
A  src/features/resume/job/suggestions.ts
A  src/features/resume/job/taxonomy.ts
A  src/features/resume/layout/engine.ts
A  src/features/resume/layout/fitting.ts
A  src/features/resume/layout/measurer.ts
A  src/features/resume/layout/templates.ts
A  src/features/resume/layout/types.ts
A  src/features/resume/model/defaults.ts
A  src/features/resume/model/storage.ts
A  src/features/resume/model/types.ts
A  src/features/resume/parse/extract.ts
A  src/features/resume/parse/parseResume.ts
A  src/features/resume/parse/patterns.ts
A  src/features/resume/parse/pdf-worker.d.ts
A  src/features/resume/resume-studio.css
A  src/features/resume/review/ParseReview.tsx
A  src/features/resume/review/checks.ts
A  src/features/resume/tailor/MasterProfileSelector.tsx
A  src/features/resume/tailor/tailorEngine.ts
A  src/features/storage/backup.ts
A  src/features/tracker/ApplicationDrawer.tsx
A  src/features/tracker/Charts.tsx
A  src/features/tracker/TrackerPage.tsx
A  src/features/tracker/model.ts
A  src/features/tracker/resumes.ts
A  src/hooks/useModalFocus.ts
A  src/lib/api/http.ts
A  src/lib/api/roadmaps.ts
A  src/lib/api/types.ts
A  src/pages/Dashboard.tsx
A  src/styles/careeros-polish.css
A  src/styles/careeros.css
A  src/styles/documents.css
A  src/styles/jobs.css
A  src/styles/tracker.css
A  src/vite-env.d.ts
```

### INCLUDE: AutoApply extension (40)

```
A  apps/extension/entrypoints/background.ts
A  apps/extension/entrypoints/content.ts
A  apps/extension/entrypoints/options/ai.tsx
A  apps/extension/entrypoints/options/index.html
A  apps/extension/entrypoints/options/main.ts
A  apps/extension/entrypoints/popup/index.html
A  apps/extension/entrypoints/popup/main.ts
A  apps/extension/entrypoints/sidepanel/AISettingsPanel.tsx
A  apps/extension/entrypoints/sidepanel/App.tsx
A  apps/extension/entrypoints/sidepanel/AutofillTab.tsx
A  apps/extension/entrypoints/sidepanel/ProfileTab.tsx
A  apps/extension/entrypoints/sidepanel/ScoreTab.tsx
A  apps/extension/entrypoints/sidepanel/index.html
A  apps/extension/entrypoints/sidepanel/lib/ai.ts
A  apps/extension/entrypoints/sidepanel/lib/autofill.ts
A  apps/extension/entrypoints/sidepanel/lib/bridge.ts
A  apps/extension/entrypoints/sidepanel/lib/context.ts
A  apps/extension/entrypoints/sidepanel/lib/model.ts
A  apps/extension/entrypoints/sidepanel/lib/questionAI.ts
A  apps/extension/entrypoints/sidepanel/main.tsx
A  apps/extension/entrypoints/sidepanel/styles.css
A  apps/extension/entrypoints/sidepanel/ui.tsx
A  apps/extension/package.json
A  apps/extension/public/icons/icon-128.png
A  apps/extension/public/icons/icon-16.png
A  apps/extension/public/icons/icon-48.png
A  apps/extension/scripts/build-mv3.mjs
A  apps/extension/src/adapters/ashby/index.ts
A  apps/extension/src/adapters/generic/index.ts
A  apps/extension/src/adapters/greenhouse/index.ts
A  apps/extension/src/adapters/index.ts
A  apps/extension/src/adapters/lever/index.ts
A  apps/extension/src/adapters/workday/index.ts
A  apps/extension/src/ai/localConnection.ts
A  apps/extension/src/detect/pageContext.ts
A  apps/extension/src/messaging/protocol.ts
A  apps/extension/src/security/permissions.ts
A  apps/extension/src/storage/stateStore.ts
A  apps/extension/tsconfig.json
A  apps/extension/wxt.config.ts
```

### INCLUDE: build, CI and config (10)

```
M  .github/workflows/deploy.yml
M  .gitignore
M  package-lock.json
M  package.json
M  tsconfig.json
M  vite.config.ts
D  vite.config.ts.example
A  eslint.config.js
A  playwright.config.ts
A  vitest.config.ts
```

### INCLUDE: documentation (29)

```
A  docs/AUTOAPPLY_GUIDE.md
A  docs/architecture/autoapply-ai-providers.md
A  docs/architecture/browser-storage.md
A  docs/architecture/cleanup-report.md
A  docs/architecture/database-design.md
A  docs/architecture/frontend-backend-integration.md
A  docs/architecture/migration-roadmap.md
A  docs/architecture/progress-and-auth-design.md
A  docs/architecture/repository-audit.md
A  docs/architecture/repository-identity.md
A  docs/architecture/spring-boot-foundation.md
A  docs/audits/careeros-accessibility.md
A  docs/audits/careeros-baseline.md
A  docs/audits/careeros-defects.md
A  docs/audits/careeros-final-quality-report.md
A  docs/audits/careeros-final-review.md
A  docs/audits/careeros-full-quality-audit.md
A  docs/audits/careeros-responsive-audit.md
A  docs/audits/careeros-route-inventory.md
A  docs/audits/careeros-selective-commit-manifest.md
A  docs/audits/careeros-test-results.md
A  docs/audits/figma-parity-matrix.md
A  docs/careeros.md
A  docs/learning/java-spring-boot-basics.md
A  docs/learning/learning-log.md
A  docs/learning/learning-roadmap.md
A  docs/learning/postgresql-jpa-flyway.md
A  docs/learning/rest-api-integration.md
A  docs/learning/spring-security-transactions.md
```

### INCLUDE: other (3)

```
M  README.md
M  index.html
D  pnpm-lock.yaml
```

### INCLUDE: shared package (4)

```
A  packages/careeros-shared/adapters/index.ts
A  packages/careeros-shared/index.ts
A  packages/careeros-shared/schemas/index.ts
A  packages/careeros-shared/types/index.ts
```

### INCLUDE: tests (50)

```
A  tests/e2e/accessibility.spec.ts
A  tests/e2e/app.spec.ts
A  tests/e2e/autoapply.spec.ts
A  tests/e2e/careeros.spec.ts
A  tests/e2e/data-safety.spec.ts
A  tests/e2e/extension-ai-settings.spec.ts
A  tests/e2e/extension-sidepanel.spec.ts
A  tests/e2e/helpers/extension.ts
A  tests/e2e/interview-studio.spec.ts
A  tests/e2e/job-match.spec.ts
A  tests/e2e/job-requirements.spec.ts
A  tests/e2e/jobs-workspace.spec.ts
A  tests/e2e/microphone-matrix.spec.ts
A  tests/e2e/resume-studio-3-ai.spec.ts
A  tests/e2e/resume-studio.spec.ts
A  tests/e2e/route-smoke.spec.ts
A  tests/e2e/speech-transcription.spec.ts
A  tests/e2e/storage-backup.spec.ts
A  tests/e2e/tracker.spec.ts
A  tests/fixtures/audio.ts
A  tests/fixtures/boards.ts
A  tests/fixtures/files.ts
A  tests/fixtures/jobs.ts
A  tests/fixtures/resumes.ts
A  tests/setup.ts
A  tests/unit/Roadmaps.test.tsx
A  tests/unit/ai/aiConnections.test.ts
A  tests/unit/analyzeResume.test.ts
A  tests/unit/autoapply/autoapply.test.ts
A  tests/unit/autoapply/localConnection.test.ts
A  tests/unit/autoapply/questionAI.test.ts
A  tests/unit/autoapply/sidepanel.test.ts
A  tests/unit/backup.test.ts
A  tests/unit/interviews/analysis.test.ts
A  tests/unit/interviews/audioProcessing.test.ts
A  tests/unit/interviews/media.test.ts
A  tests/unit/interviews/transcription.test.ts
A  tests/unit/job/extractRequirements.test.ts
A  tests/unit/job/match.test.ts
A  tests/unit/jobs/jobs.test.ts
A  tests/unit/migrations.test.ts
A  tests/unit/resume/document.test.tsx
A  tests/unit/resume/export.test.ts
A  tests/unit/resume/fitting.test.ts
A  tests/unit/resume/layout.test.ts
A  tests/unit/resume/parseResume.test.ts
A  tests/unit/resume/reference.test.ts
A  tests/unit/resume/tailor.test.ts
A  tests/unit/roadmaps-api.test.ts
A  tests/unit/storage.test.ts
```

### OPTIONAL: test evidence screenshots (42)

```
A  docs/audits/release-screenshots/docked-sidepanel-headed.png
A  docs/audits/release-screenshots/docked-sidepanel-headless.png
A  docs/autoapply-side-panel/screenshots/autofill-320.png
A  docs/autoapply-side-panel/screenshots/autofill-360.png
A  docs/autoapply-side-panel/screenshots/autofill-390.png
A  docs/autoapply-side-panel/screenshots/autofill-420.png
A  docs/autoapply-side-panel/screenshots/autofill-450.png
A  docs/autoapply-side-panel/screenshots/autofill-results-390.png
A  docs/autoapply-side-panel/screenshots/popup.png
A  docs/autoapply-side-panel/screenshots/profile-390.png
A  docs/autoapply-side-panel/screenshots/score-390.png
A  docs/autoapply-side-panel/screenshots/tailor-resume-studio.png
A  docs/autoapply-side-panel/screenshots/unsupported-390.png
A  docs/careeros-4/screenshots/cover-letter-editor.png
A  docs/careeros-4/screenshots/documents-1024.png
A  docs/careeros-4/screenshots/documents-1440.png
A  docs/careeros-4/screenshots/documents-1920.png
A  docs/careeros-4/screenshots/documents-375.png
A  docs/careeros-4/screenshots/documents-430.png
A  docs/careeros-4/screenshots/documents-768.png
A  docs/careeros-4/screenshots/jobs-1024.png
A  docs/careeros-4/screenshots/jobs-1440.png
A  docs/careeros-4/screenshots/jobs-1920.png
A  docs/careeros-4/screenshots/jobs-375.png
A  docs/careeros-4/screenshots/jobs-430.png
A  docs/careeros-4/screenshots/jobs-768.png
A  docs/careeros-4/screenshots/jobs-desktop.png
A  docs/careeros-4/screenshots/matches-1024.png
A  docs/careeros-4/screenshots/matches-1440.png
A  docs/careeros-4/screenshots/matches-1920.png
A  docs/careeros-4/screenshots/matches-375.png
A  docs/careeros-4/screenshots/matches-430.png
A  docs/careeros-4/screenshots/matches-768.png
A  docs/careeros-4/screenshots/matches-desktop.png
A  docs/careeros-4/screenshots/tracker-1024.png
A  docs/careeros-4/screenshots/tracker-1440.png
A  docs/careeros-4/screenshots/tracker-1920.png
A  docs/careeros-4/screenshots/tracker-375.png
A  docs/careeros-4/screenshots/tracker-430.png
A  docs/careeros-4/screenshots/tracker-768.png
A  docs/careeros-4/screenshots/tracker-board.png
A  docs/careeros-4/screenshots/tracker-chart.png
```

### HOLD: 3.7 MB binary model (confirm license and provenance) (1)

```
A  public/models/face_landmarker.task
```

### HOLD: Spring Boot roadmap API (needs an owner decision) (57)

```
A  apps/api/.env.example
A  apps/api/.gitattributes
A  apps/api/.gitignore
A  apps/api/.mvn/wrapper/maven-wrapper.properties
A  apps/api/compose.yaml
A  apps/api/mvnw
A  apps/api/mvnw.cmd
A  apps/api/pom.xml
A  apps/api/src/main/java/dev/eskinder/roadmap/RoadmapApplication.java
A  apps/api/src/main/java/dev/eskinder/roadmap/common/error/ApiError.java
A  apps/api/src/main/java/dev/eskinder/roadmap/common/error/GlobalExceptionHandler.java
A  apps/api/src/main/java/dev/eskinder/roadmap/common/error/ValidationError.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressConfiguration.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressConflictException.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressController.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressPrincipalNotFoundException.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressService.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/ProgressStatus.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/StageNotFoundException.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/dto/ProgressResponse.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/dto/UpsertProgressRequest.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/persistence/ApplicationUserEntity.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/persistence/ApplicationUserRepository.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/persistence/UserStageProgressEntity.java
A  apps/api/src/main/java/dev/eskinder/roadmap/progress/persistence/UserStageProgressRepository.java
A  apps/api/src/main/java/dev/eskinder/roadmap/roadmap/RoadmapController.java
A  apps/api/src/main/java/dev/eskinder/roadmap/roadmap/RoadmapNotFoundException.java
A  apps/api/src/main/java/dev/eskinder/roadmap/roadmap/RoadmapService.java
A  apps/api/src/main/java/dev/eskinder/roadmap/roadmap/dto/RoadmapResponse.java
A  apps/api/src/main/java/dev/eskinder/roadmap/roadmap/dto/RoadmapStageResponse.java
A  apps/api/src/main/java/dev/eskinder/roadmap/roadmap/persistence/RoadmapEntity.java
A  apps/api/src/main/java/dev/eskinder/roadmap/roadmap/persistence/RoadmapRepository.java
A  apps/api/src/main/java/dev/eskinder/roadmap/roadmap/persistence/RoadmapStageEntity.java
A  apps/api/src/main/java/dev/eskinder/roadmap/roadmap/persistence/RoadmapStageRepository.java
A  apps/api/src/main/java/dev/eskinder/roadmap/roadmap/persistence/StageOutcomeEntity.java
A  apps/api/src/main/java/dev/eskinder/roadmap/security/ApiAccessDeniedHandler.java
A  apps/api/src/main/java/dev/eskinder/roadmap/security/ApiAuthenticationEntryPoint.java
A  apps/api/src/main/java/dev/eskinder/roadmap/security/AuthenticatedIdentity.java
A  apps/api/src/main/java/dev/eskinder/roadmap/security/CurrentIdentityResolver.java
A  apps/api/src/main/java/dev/eskinder/roadmap/security/LocalBasicAuthenticationEntryPoint.java
A  apps/api/src/main/java/dev/eskinder/roadmap/security/OidcSecurityConfiguration.java
A  apps/api/src/main/java/dev/eskinder/roadmap/security/SecurityConfiguration.java
A  apps/api/src/main/java/dev/eskinder/roadmap/security/SecurityErrorWriter.java
A  apps/api/src/main/resources/application.yml
A  apps/api/src/main/resources/db/migration/V1__create_roadmap_schema.sql
A  apps/api/src/main/resources/db/migration/V2__seed_roadmap_catalog.sql
A  apps/api/src/main/resources/db/migration/V3__create_user_progress.sql
A  apps/api/src/main/resources/db/migration/V4__scope_users_by_oidc_issuer.sql
A  apps/api/src/test/java/dev/eskinder/roadmap/RoadmapApplicationTests.java
A  apps/api/src/test/java/dev/eskinder/roadmap/progress/ProgressControllerTest.java
A  apps/api/src/test/java/dev/eskinder/roadmap/progress/ProgressPersistenceIntegrationTest.java
A  apps/api/src/test/java/dev/eskinder/roadmap/roadmap/RoadmapControllerTest.java
A  apps/api/src/test/java/dev/eskinder/roadmap/roadmap/RoadmapPersistenceIntegrationTest.java
A  apps/api/src/test/java/dev/eskinder/roadmap/roadmap/RoadmapServiceTest.java
A  apps/api/src/test/java/dev/eskinder/roadmap/security/LocalBasicSecurityTest.java
A  apps/api/src/test/java/dev/eskinder/roadmap/support/OidcTestIssuer.java
A  apps/api/src/test/java/dev/eskinder/roadmap/support/PostgresIntegrationTest.java
```
