# CareerOS defect register

Severity counts for confirmed issues: **5 high, 9 medium, 1 low**. TypeScript, lint, build and the browser suite passed after these fixes. The Verification column distinguishes directly tested behavior from checks still pending.

| ID | Screen | Defect | Severity | Evidence | Fix | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| D01 | Settings | Export omitted application records under `appTracker:items` and corrupted raw non-JSON preferences | High | Pre-edit `exportData` used only `listKeys("pd:")` and `getLocal` JSON parsing | Versioned raw-value backup includes project storage prefixes | Backup round-trip Playwright test |
| D02 | Settings | “Reset all” left application records and other legacy keys | High | Pre-edit reset removed only `pd:` keys | Shared project-key inventory for export and reset | Source review; isolated backup test, reset itself not automated |
| D03 | Jobs | One click permanently removed a saved posting | High | Pre-edit Remove button directly filtered state | Confirmation before delete | Desktop/mobile cancel and accept browser tests |
| D04 | Mobile shell/actions | Content CTAs were forced to 34px width at ≤430px; larger touch targets initially caused a 320px top-bar regression | High | Baseline mobile screenshot; measured 320px overflow during repair | Scope compact icon rule to top bar, remove false notification, hide profile on the narrowest widths | 320–1920px route audit and overflow Playwright test |
| D05 | Interview Studio | Mode/question changes and note saving could proceed while recording, obscuring the recording state | High | Pre-edit controls had no recording guard | Disable conflicting controls, show recording status, handle denial/interruption, stop stream | Typecheck and browser notes test; hardware interruption not automated |
| D06 | Jobs | User-added postings could not be edited | Medium | No edit control or update path | Reuse validated form for edits while preserving ID and saved date | Desktop/mobile edit and reload test |
| D07 | Mobile Jobs | Filter/list/detail stacked as desktop panels, with detail far below cards | Medium | Baseline 390px screenshot | Compact search/filter, list, full detail state with Back action | Mobile browser create/track/edit tests and final screenshot |
| D08 | Top bar | “New application” opened the tracker without the form | Medium | Link pointed to `/applications` | Route query opens the form | Desktop/mobile quick-create test |
| D09 | Job/Application dialogs | Initial focus, focus containment, Escape and focus restoration were incomplete | Medium | Pre-edit forms had only `role="dialog"` | Shared modal focus hook | Quick-create focus/Escape/restore and job form tests |
| D10 | Applications | New “Saved” records received today’s date even when no event occurred | Medium | Pre-edit draft initialized `date` to current day | Date now optional and blank by default | Quick-create browser assertion |
| D11 | Shell | Notification bell implied an active notification service but always said “all caught up” | Medium | Static popover in shell | Removed the control | Source and screenshot review |
| D12 | Settings | Reduced-motion control did not rerender immediately after saving | Medium | Pre-edit value read from storage on render, setter did not update React state | State now uses `useLocal`; native button keyboard behavior retained | Typecheck and browser route check; dedicated persistence test pending |
| D13 | Settings | Invalid import could reject without a useful message; existing values could be silently overwritten | Medium | Pre-edit uncaught JSON parse and direct key writes | Validate before writes, confirm replacement, report import error, support legacy format | Backup round-trip test; malformed-file test pending |
| D14 | Jobs | Search placeholder promised skill matching, but filter ignored `skills` | Low | Pre-edit filter string excluded skill tags | Include saved skills in keyword index | Source review; browser skill-search test pending |
| D15 | Legacy Trackers | A screen-reader-only table header escaped its scroll container and caused 221px page overflow at 390px | Medium | 44-route browser sweep and DOM measurement | Make the table header a positioning container | Repeat sweep: 44 routes × 2 widths, zero overflow |

## Known gaps outside this repair

The new application table does not yet sort/filter or expose its own import/export controls; the legacy tracker remains available. Résumé DOCX export, persisted interview audio, live job data, generative AI, and cloud sync are not implemented. The settings JSON backup does not include IndexedDB video bytes. These are explicit product limitations, not verified working features.
