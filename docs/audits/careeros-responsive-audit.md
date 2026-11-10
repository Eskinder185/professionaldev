# Responsive audit

> Historical audit of the full uncommitted worktree. The selective CareerOS commit excludes the separate auth and Spring Boot roadmap/API changes; see the commit manifest for exact candidate verification.

Playwright rendered nine primary routes in light and dark mode at **320, 375, 390, 430, 768, 1024, 1280, 1440, and 1920px**. That is 238 route/viewport/theme observations, including extra legacy routes at 390 and 1440px. Fresh isolated browser contexts, reduced motion, and empty local data kept screenshots stable. The final primary-route matrix found **zero page errors, failed local requests, or document-level horizontal overflow**.

| Width | Final primary-route result | Notes |
| --- | --- | --- |
| 320 | Pass, both themes | Compact top-bar controls fit; content CTAs no longer compress to icon width |
| 375 | Pass, both themes | Mobile bottom navigation and cards fit |
| 390 | Pass, both themes | Jobs use search/filter list and a separate detail state |
| 430 | Pass, both themes | Forms and action labels remain readable |
| 768 | Pass, both themes | Tablet layouts use available width; no page scroll sideways |
| 1024 | Pass, both themes | Sidebar/content transition remains contained |
| 1280 | Pass, both themes | Multi-column desktop panels fit |
| 1440 | Pass, both themes | Screenshot comparison set captured |
| 1920 | Pass, both themes | Content maximum avoids full-width reading lines |

The 44-route legacy sweep at 390 and 1440px initially found a 221px document overflow on `/resources/trackers`: the visually hidden Actions header was positioned outside its horizontally scrollable table. The header now establishes a positioning context. The repeated sweep found **zero overflow, page errors, and failed local requests across 88 observations**. The table itself retains local horizontal scrolling, which is appropriate for tabular data.

Desktop and mobile before/after screenshots for dashboard, jobs, academy, applications, résumé, analytics, coach, interviews, and settings are under the local audit directory:
`<local-audit-root>\audit\{baseline,final}\{light,dark}\{390,1440}-<route>.png`.
Contact sheets in the same directory summarize the nine screens. Screenshots are outside source control and use no personal records.

Limitations: automated overflow checks do not prove every touch target, virtual keyboard state, or landscape layout. The desktop/mobile Playwright suite tests the key interactions; physical device and manual zoom/reflow review remain useful.
