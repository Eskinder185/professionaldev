# Figma parity matrix

Source: [CareerOS Figma design](https://www.figma.com/design/okBcCPeB7OLtkMySARJvdl), `CareerOS screens` page. The 15 frame names and dimensions below were verified in the preceding design session. Dashboard desktop, Job Discovery desktop/mobile, and Résumé Studio desktop were visually inspected then; the other frames were inventoried structurally but their visual details could not be reopened after the Figma Starter tool-call limit. This is a comparison of accessible evidence, **not** a pixel-parity certification.

The documented shared palette uses light canvas `#F8FAFC`, white surface, `#2563EB` accent, and `#0F172A` text; dark surfaces use `#141C30`/`#1B2740` with `#60A5FA` accent. The app uses these semantic roles. Exact frame typography, gaps, component bounds, and mobile variants were not measurable after access was exhausted.

| Actual frame | Target route | Viewport | Layout and navigation evidence | Typography, colors, components | Interactions / implementation difference | Severity / status |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard desktop | `/dashboard` | 1440×1050 | Sidebar, top bar, hero, metrics and content panels visible in prior reference | Palette aligned by documented tokens; exact type/spacing unmeasured | Live local metrics, goal and next steps; app screenshot reviewed | Low / improved, exact parity unverified |
| Dashboard mobile | `/dashboard` | 390×1320 | Mobile frame inventoried; visual hierarchy not reopened | Unmeasured | App uses bottom navigation; fifth metric now spans mobile grid | Unverified / blocked |
| Job Discovery desktop | `/jobs` | 1440×900 | Prior reference showed filter/list/detail arrangement | Palette aligned; exact card metrics unmeasured | App now supports edit, delete confirmation, local search and detail | Medium / improved |
| Job Discovery mobile | `/jobs` | 390×1120 | Prior reference showed mobile job browsing | Exact spacing unmeasured | App now has compact search/filter, card list and full detail state | Medium / improved |
| Job details | `/jobs` selected posting | 1440×900 | Frame inventoried only | Unmeasured | Same-route detail panel; no dedicated URL or verified Figma interaction | Unverified / blocked |
| Learning Academy desktop | `/academy` | 1440×900 | Frame inventoried only | Unmeasured | Three authored lessons, progress and filters render | Unverified / blocked |
| Learning Academy mobile | `/academy` | 390×1120 | Frame inventoried only | Unmeasured | Single-column lesson cards render | Unverified / blocked |
| Reading Focus Mode | `/academy` lesson | 1440×900 | Frame inventoried only | Unmeasured | Reader/focus mode and progress work; no exact comparison | Unverified / blocked |
| Résumé Studio desktop | `/resume` | 1440×900 | Prior reference showed three-pane editor/preview/review | Palette aligned; exact document scale unmeasured | App uses local heuristic review and print/PDF; DOCX export absent | Medium / reviewed, partial |
| Résumé Studio mobile | `/resume` | 390×1120 | Frame inventoried only | Unmeasured | App uses Content/Preview/Review tabs | Unverified / blocked |
| Application Tracker | `/applications` | 1440×900 | Frame inventoried only | Unmeasured | Board/table/timeline use local records | Unverified / blocked |
| Interview Studio | `/interviews` | 1440×900 | Frame inventoried only | Unmeasured | Recording and notes present; audio remains memory-only | Unverified / blocked |
| AI Career Copilot | `/coach` | 1440×900 | Frame inventoried only | Unmeasured | App truthfully labels its rule-based local guide | Unverified / blocked |
| Onboarding | No dedicated onboarding route | 390×1120 | Frame inventoried only | Unmeasured | Current first-use experience is dashboard/empty-state guidance | Medium / deferred |
| Settings | `/settings` | 1440×900 | Frame inventoried only | Unmeasured | Motion and data management present | Unverified / blocked |

The app's [baseline and final screenshots](careeros-final-review.md) provide reproducible implementation evidence. Accessibility and truthful functionality took precedence where the schematic frame lacked interaction detail. Reopen the remaining 11 frames when Figma access is available, then record exact typography, spacing, component states, and measured deltas.
