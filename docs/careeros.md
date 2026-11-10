# ProfessionalDev CareerOS: local implementation

> Commit scope: this frontend CareerOS package excludes the separate Spring Boot roadmap API and authentication work present in the larger audit worktree.

## Initial audit

At the start of this work the repository already had substantial uncommitted changes. They were preserved. The application had a React 18, TypeScript, Vite, Tailwind and React Router foundation, light and dark mode, lazy legacy routes, browser storage migrations, a separate local Spring Boot roadmap API, and Playwright/Vitest checks. The API is outside this selective frontend commit. Existing working tools included self assessments, the résumé grader, interview simulator, STAR tools, elevator pitch, portfolio and profile guides, application tracker, certification resources, tech hub, and a rule based PD Coach.

The product was organized as separate resource and tool pages. It had no unified workspace shell, connected dashboard, authorized job feed, authored lesson reader, résumé version editor, or secure cloud/AI service. Browser data lives under several historic keys. The existing application tracker uses `appTracker:items`; the skill tracker uses `pd:resources:skills:list`. The current build and test commands use Vite's default config bundler, which cannot read parent directories under this workstation's sandbox. `--configLoader runner` succeeds. This is an environment limitation, not an application compile error.

## New workspace

- `/dashboard`: saved-record metrics, career goal, focus tasks, learning continuation, honest job empty state, application pipeline.
- `/jobs`: personal job library, keyword and arrangement filters, saved searches, posting details, source link, and a path to add a saved role to applications. All postings are labeled user added. `JobSource` is the typed integration boundary; no live source is registered.
- `/applications`: board, table, and timeline views over the original tracker key. Status moves have a keyboard accessible selector. Table editing, follow-up dates, and deletion are local.
- `/academy`: three authored lessons with quiz feedback, notes, bookmarks, reader text size, focus mode, and local progress. Other category options intentionally show an empty state.
- `/resume`: browser local versions, import of PDF/DOCX/TXT, text editing, role comparison, heuristic review, preview, and print to PDF. The original grader remains available.
- `/interviews`: five practice modes, question navigation, timer, optional microphone recording and replay, and consent based local notes history. Audio is not persisted.
- `/analytics`: counts and a stage chart from actual local records.
- `/coach`: clearly labeled local rule based guidance. It does not send data to an AI service.

The original root marketing page and legacy routes remain available. The workspace uses shared semantic colors and responsive desktop sidebar/mobile bottom navigation. Sidebar collapse preference, goal, tasks, saved jobs/searches, lessons, résumé versions, and coach history are browser local. `src/styles/careeros.css` holds scoped workspace components; the existing Tailwind theme tokens now use the CareerOS blue and slate palette.

## Design system

An editable [CareerOS Figma file](https://www.figma.com/design/okBcCPeB7OLtkMySARJvdl) contains 15 screen frames on a `CareerOS screens` page, light and dark semantic color variables, and imported reusable button/card/input specimens on a foundations page. Representative dashboard, jobs, and résumé frames were visually inspected; dashboard text spacing was repaired. These frames are design representations, not functioning prototypes. The Figma Starter plan tool-call limit stopped further foundation/component construction and a full 15-screen visual audit. Do not treat the Figma file as a published production component library yet.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#F8FAFC` | `#0B1020` |
| Surface | `#FFFFFF` | `#141C30` |
| Raised surface | `#FFFFFF` | `#1B2740` |
| Accent | `#2563EB` | `#60A5FA` for contrast |
| Primary text | `#0F172A` | `#F8FAFC` |

Typography uses the existing system font stack with Inter when installed. Headings scale with `clamp()`. The layout follows a 4px spacing rhythm, 8–14px control/card radii, 64px top bar, 248px sidebar, 72px collapsed sidebar, and a 1440px content maximum. Borders and small shadows separate surfaces. Focus rings are visible; motion is 160–180ms and follows reduced motion preferences. The mobile breakpoint is 900px, with narrower card and form layouts at 750px, 520px, and 430px. The bottom navigation includes safe area padding.

## Data and privacy

There is no cloud synchronization for the new workspace. Browser storage is neither encrypted nor a secure private account. The separate local Spring Boot API integration is outside this selective frontend commit. New data is under `pd:careeros:*`; applications continue to use `appTracker:items`. No résumé, coach message, or job detail is sent to a model or a job provider. Saved job availability is unverified. The dashboard does not synthesize user achievements or job recommendations.

## Current limits and next implementation gates

The requested six phase vision is larger than the local implementation. In particular, these are not complete: authorized live job feeds and deduplication; comprehensive academy courses and verified proficiency; DOCX export and full document layout controls; AI interview feedback and saved audio history; drag and drop, calendar integration, response time metrics, and data import in the new application view; authenticated cloud migration; generative AI, rate limiting, cost controls, and billing. Existing tools provide some related functionality, but they have not been relabeled as those advanced services.

Production service work needs an approved data provider, backend deployment, identity design, privacy policy, and service credentials. Those values belong on a secure server, never in Vite client variables. The `JobSource` interface is intentionally empty until provider terms and access are established. No paid service was added.

## Running checks in this workstation sandbox

```powershell
npm run lint
npm run typecheck
npx vitest run --configLoader runner
npx vite build --configLoader runner
npx vite preview --configLoader runner --host 127.0.0.1 --port 4173
npx playwright test --workers=2
```

The normal `npm run build` and `npm run test` scripts remain unchanged for CI and unrestricted machines. Their default config loading is blocked by this workstation sandbox. Browser tests can use an already running preview on port 4173.

## Deployment

The static workspace is buildable and can be served from the existing `/professionaldev/` base path. No push or deployment was performed. The new features are guest/browser local, so a public deployment should clearly communicate that data is specific to the current browser. A secure SaaS launch needs the service gates above.
