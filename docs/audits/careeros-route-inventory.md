# Route inventory

`src/App.tsx` declares **44 concrete routes** plus a wildcard. Each concrete route was opened directly in a fresh local preview at 390px and 1440px. All 88 requests returned HTTP 200, rendered a heading, had no uncaught page error or failed local asset request, and had no document-level horizontal overflow after the tracker fix. Lazy routes showed the shared loading status when needed. This route sweep verifies rendering and reflow, while interaction coverage is described in [test results](careeros-test-results.md). An unknown path rendered the “Page not found” state in the primary-route matrix.

| Path | Screen / primary function | Navigation entry | Figma frame |
| --- | --- | --- | --- |
| `/` | Marketing home | Root | — |
| `/auth/callback` | Authentication result; expected sign-in failure without callback parameters | None | — |
| `/dashboard` | Goal, tasks, stored metrics, next steps | Dashboard | Dashboard desktop/mobile |
| `/jobs` | User-added jobs, filters, detail and tracker link | Discover Jobs | Job Discovery desktop/mobile; Job details |
| `/academy` | Lesson cards, reader, quiz, progress | Learning Academy | Learning Academy desktop/mobile; Reading Focus Mode |
| `/applications` | Board, table, timeline and record editing | My Applications | Application Tracker |
| `/resume` | Local versions, import, preview, heuristic review | Résumé Studio | Résumé Studio desktop/mobile |
| `/analytics` | Actual record counts and stage chart | Career Analytics | — |
| `/coach` | Local rule-based guidance | Career Coach | AI Career Copilot (conceptual only) |
| `/interviews` | Questions, timer, optional recording, notes | Interview Studio | Interview Studio |
| `/about` | Product approach | Legacy/linked | — |
| `/settings` | Motion and data controls | Settings | Settings |
| `/self-assessment` | Assessment hub | Legacy/linked | — |
| `/self-assessment/strengths` | Strengths quiz | Legacy/linked | — |
| `/self-assessment/values` | Values worksheet | Legacy/linked | — |
| `/self-assessment/interests` | Interests quiz | Legacy/linked | — |
| `/self/strengths` | Strengths test | Legacy/linked | — |
| `/self/values` | Core values workshop | Legacy/linked | — |
| `/self/interests` | Career interests map | Legacy/linked | — |
| `/career-tools` | Career tools hub | Legacy/linked | — |
| `/career-tools/resume-grader` | Original résumé grader | Legacy/linked | — |
| `/career-tools/star` | STAR practice | Legacy/linked | — |
| `/career-tools/stories` | Interview story builder | Legacy/linked | — |
| `/career-tools/behavioral` | Behavioral question bank | Legacy/linked | — |
| `/career-tools/elevator` | Elevator pitch | Legacy/linked | — |
| `/career-tools/elevator-studio` | Elevator pitch studio | Legacy/linked | — |
| `/career-tools/portfolio` | Portfolio/GitHub guide | Portfolio | — |
| `/career-tools/star-builder` | STAR Builder | Legacy/linked | — |
| `/career-tools/interview-sim` | Original mock interview | Legacy/linked | — |
| `/career/star-tool` | STAR tool compatibility route | Legacy/linked | — |
| `/career/portfolio-audit` | Portfolio audit | Legacy/linked | — |
| `/career-tools/linkedin` | LinkedIn guide | Legacy/linked | — |
| `/career-tools/github` | GitHub profile guide | Legacy/linked | — |
| `/resources` | Resource hub | Resources | — |
| `/resources/roadmaps` | Career/certification roadmaps | Career Roadmap | — |
| `/resources/certs` | Certifications and learning | Legacy/linked | — |
| `/Resources/Certs` | Compatibility alias | None | — |
| `/resources/trackers` | Skills and lightweight application CRM | Skills Profile | — |
| `/resources/productivity` | Productivity tools | Legacy/linked | — |
| `/Resources/JobSites` | Compatibility alias | None | — |
| `/resources/job-sites` | External job-site guide | Legacy/linked | — |
| `/resources/app-tracker` | Original application tracker | Legacy/linked | — |
| `/contact` | Contact/help | Help | — |
| `/tech-career-hub` | Technical career hub | Legacy/linked | — |

Mobile behavior for the nine primary screens was visually captured at 390px; other legacy routes were checked for rendering and page-level overflow at 390px. Accessibility issues beyond the sampled workflows may remain. The local Spring Boot roadmap API was not running during the sweep, so the preview proxy logged connection refusals for `/api/v1/roadmaps`; the Roadmaps page rendered its explicit API-unavailable state. Its browser test uses a mocked API response. Local preview supports direct deep links. The configured build script copies `index.html` to `404.html` for GitHub Pages fallback; the copy was checked locally, but the deployed site was not changed or retested.
