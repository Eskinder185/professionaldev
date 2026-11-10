# Accessibility review

Target: WCAG 2.2 AA. This pass verified selected keyboard and reflow workflows; it is **not** a full conformance assessment. `axe-core` and `@axe-core/playwright` are not installed, so no axe scan was claimed.

## Verified improvements

- Job and application dialogs now move focus to the first field, contain Tab focus, close on Escape, and restore focus to the invoking control. Playwright asserts initial focus and Escape restoration on desktop and mobile.
- Top-bar quick create opens the named application dialog. The mobile job list has explicit search/filter and Back controls; saved job deletion requires confirmation.
- Primary CareerOS actions and top-bar icon controls use at least 44px targets. The narrowest top bar hides the duplicate profile shortcut; settings remain available from navigation.
- Reduced-motion CSS remains active for the workspace. Recording state is announced with `role="status"`; form errors use `role="alert"`.
- Resume and Settings file upload labels now display a focus ring when their file inputs receive keyboard focus. Settings import input remains visually hidden but keyboard focusable.
- The legacy tracker table retains its scroll container, and its screen-reader-only Actions header no longer causes document-level mobile overflow.
- Existing navigation, sidebar collapse, mobile drawer, theme switching, lesson progression, and form submission were exercised in Playwright.

## Remaining manual checks

An assistive-technology pass is still needed for screen-reader naming, dialog background isolation, live-region verbosity, and table editing. Color contrast was judged visually in light/dark screenshots but not measured against every text/background pair. Browser zoom/reflow at 200–400%, virtual keyboard behavior, physical-device touch targets throughout legacy tools, and microphone-denial announcements need direct manual verification. The current checks support a targeted improvement claim, not WCAG certification.
