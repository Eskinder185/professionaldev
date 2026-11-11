# CareerOS: make it feel effortless

## What CareerOS is for

CareerOS (https://eskinder185.github.io/professionaldev/, repo `C:\Users\eskew\github\professionaldev`) helps people get hired, mostly early-career and career-changing people aiming at IT, cloud, support, and software roles. Many of them are anxious, applying to dozens of jobs, and not technical about AI.

It makes three promises, and every design decision should serve them:

1. **Your data stays yours.** Everything is stored in the browser. Nothing is uploaded unless the person chooses it.
2. **It never lies for you.** No invented skills, jobs, scores, or "connected" states. A truthful résumé and an honest status beat an impressive one.
3. **You stay in control.** The AI prepares; the person approves. Nothing is submitted, sent, or agreed to on their behalf without an explicit yes.

The product today works but feels like a set of tools built by different people. Your job is to make it feel like one calm, obvious product: a new visitor should understand what to do in ten seconds and never wonder whether a click worked.

## Where things stand (verified, do not redo)

- Branch `feat/careeros-autoapply-extension`, with a large uncommitted working tree from several agents. A verified snapshot is in `C:\Users\eskew\professionaldev-recovery\`. Never discard, reset, clean, force-push, commit, or deploy without being asked.
- Baseline before this work: typecheck clean, lint clean, 197 unit tests passing.
- The site is static (GitHub Pages, base path `/professionaldev/`). There is no backend.
- Already built and working: Dashboard, Jobs/Matches, Tracker, Documents, Résumé Studio, Interview Studio, AutoApply page plus a practice sandbox, AI provider adapters (`src/features/ai/`: Ollama, OpenAI-compatible, Gemini, Anthropic), a Chrome extension (`apps/extension/`: popup, side panel, options).
- Design tokens exist in `src/styles/tokens.css` (`--cos-*`: surfaces, text, borders, accent, status, spacing, radius, motion, focus, layers) and shared controls in `src/styles/components.css` (`cos-btn`, `cos-card`, `cos-chip`, `cos-segmented`, `cos-field`, `cos-stepper`, `cos-dialog`, `cos-choice`, `cos-notice`, `cos-progress`). Use these. Do not add another colour system or UI framework.
- Appearance is Light / Dark / System (`src/theme/ThemeProvider.tsx`, Settings page), applied before first paint.
- AutoApply dark mode was broken because its stylesheet defined light-only colours and ignored the theme. It now uses the tokens. `tests/e2e/theme.spec.ts` and `tests/e2e/helpers/contrast.ts` measure real contrast in both themes; extend them to every screen you touch.
- The AutoApply page used to say "Connected" when no extension was installed (the site bundles the extension's script for its sandbox). It now says "Practice mode" unless the real extension is present. Keep that distinction everywhere.
- Still light-only or inconsistent: `interview-studio.css`, `documents.css`, `tracker.css`, `jobs.css`, parts of `careeros.css`, and all extension surfaces.

Read the code before trusting this list, and tell me if something here is out of date.

## The experience, as one journey

Build and judge everything along this path. Each step lists what the person sees, the states that must exist, and how I will check it.

### 1. Home: "what is this and what do I do first?"

The top of the dashboard is one calm panel, not a grid of equal cards.

- Headline: **Your AI. Your career. Your control.** One sentence under it: "Connect your own AI to find jobs, tailor your résumé, prepare applications, and practise interviews."
- One primary button. Its label depends on the real state: **Connect your AI** (nothing connected) or **Continue with Autopilot** (connected and tested).
- Two quiet secondary links at most: "Use AI on this computer" and "Use a cloud AI".
- Under the panel, three plain-language reasons in a single row: private (runs on your computer), free to run, works without an account.
- Once connected, the panel shrinks to a status strip: provider, model, a status chip with text ("Ready", "Not responding", "Checking…"), "On this computer" or "Cloud", and three actions: Test, Switch model, Settings.

"Ready" may only appear after a real reply from the model in this session. A saved setting that has not been checked says "Not checked yet".

Check: a first-time visitor's eye lands on the headline, then the one button. Nothing technical (URLs, ports, CORS, "endpoint", "handshake") appears on this screen.

### 2. Connect: local AI found, or helped into existence

Pressing the button opens a focused sheet (dialog on desktop, bottom sheet on phones), not a settings page.

- **Ask first.** "CareerOS can check whether an AI app is running on this computer. It only checks the standard addresses for Ollama and LM Studio." Buttons: **Allow and check** / **Not now**. Remember the answer; never check before it.
- **Checking.** A short list that ticks through each app by name with a subtle progress indicator. Keep it under about three seconds per app, then move on.
- **Results**, one of these, each with a single obvious next action:
  - Found with models: a card per model with name, size if the app reports it, "good for" tags, and **Use this model**.
  - Found, no models: "Ollama is running but has no models yet." → **Get a model**.
  - Running but the browser was refused: explain in one sentence and show the exact fix (see technical realities) with a copy button and **Try again**.
  - Nothing running: "No AI app is running right now. If you've installed one, open it and try again." → **Try again** / **Help me install one**. Never say "nothing is installed"; the browser cannot know that.
- **Test.** Choosing a model sends one short real prompt and shows the reply and how long it took. Only then show "Ready".

Only the approved loopback addresses are ever contacted. No port scanning, no other hosts.

### 3. Install helper: for people who have never done this

A six-step assistant with a visible stepper, Back that never loses answers, and progress saved if they leave.

1. Your computer: Windows or macOS (pre-select from the browser, let them change it).
2. Which app: Ollama ("simple, runs quietly in the background") or LM Studio ("a window where you can browse and chat with models"). Two cards, one sentence each.
3. Your hardware: memory, graphics card, free disk space. The browser cannot read these reliably, so ask, and say where to find each value on their system. Offer "I'm not sure" with a safe small default.
4. Recommended model: one clear recommendation and at most two alternatives, each with download size and what it is good at. Before listing any model, verify its exact name, size, licence, and that it exists in the chosen app's library today. If you cannot verify one, leave it out and say so in your report. Do not present guesses as facts.
5. Install: the official download link, then the exact commands with copy buttons, numbered, with "what you should see" after each. CareerOS never runs commands or downloads models itself; say that plainly.
6. Connect: runs step 2's check and test.

### 4. Cloud AI: honest about what is and isn't possible

Provider cards (OpenAI, Gemini, Anthropic, other compatible services) with a short, plain comparison: runs on their servers, may cost money, your text leaves this computer.

This site has no backend, so there is nowhere safe to keep a key. Unless you build a real secure store, each card shows **Setup required** and explains why in two sentences. If an existing flow keeps a key in memory for the current tab only, label it exactly that way ("Used for this tab only. Not saved."). Never write keys to localStorage, IndexedDB, backups, the bundle, or extension content scripts, and never show a cloud provider as connected without a real reply.

### 5. Autopilot: a plan you can read and stop

One page with three zones.

- **Goal** (top): a single text box with an example ("Find five entry-level cloud support jobs that match my experience and help me prepare the applications"), the model in use, and Start.
- **Plan** (centre): a vertical timeline of plain steps. Each step is clearly one of: planned, working now, waiting for you, done, skipped, failed. The current step says what it is doing in a sentence.
- **Needs you** (right, or a sheet on phones): anything waiting for a decision, with the context needed to decide and the choices as buttons. An unfamiliar form field shows the field, why it was not filled, and: Answer it myself / Skip this field / Review the application.

Controls: Start, Pause, Resume, Stop. Pause means no new step begins. Stop cancels everything not yet done and says what was cancelled. Both must be true in code, and tested.

Jobs come only from sources the person has saved or pasted, or sources they have explicitly connected. If no source exists, say so and point to where to add one. Never invent listings.

The model plans; it does not act. Its output is parsed into a fixed list of allowed steps and validated. Model text is never executed as code, never becomes a URL to open without validation, and never ticks a legal or eligibility declaration. Every real submission needs its own explicit approval on the review screen.

### 6. AutoApply and the extension: one product in two places

- Page layout follows the work: queue on the left, the selected application in the centre (job, résumé version, prepared answers), status and history on the right. On phones this is list → detail with Back preserving position.
- The extension popup and side panel use the same tokens, type scale, chips, and button styles as the site, and honour Light / Dark / System.
- Autofill and submitting are different things and must look different. Autofill shows progress per field and ends with a summary: filled and verified, needs you, skipped. Cancel really cancels. Nothing is ever submitted by autofill.
- Rename technical labels to what they mean for the person. Keep the existing engine; do not replace it.

## Design language

Quiet, confident, and consistent. Linear's density and Apple's restraint, in CareerOS's own navy-and-blue identity. Original work only: no copied layouts, icons, or assets.

- **One primary action per view.** Everything else is secondary or quiet.
- **Hierarchy through size and space, not decoration.** Page title 28–32px, section 20px, card title 16px, body 14–15px, metadata 12–13px. Two weights (regular and semibold) cover almost everything.
- **Spacing on the scale** 4, 8, 12, 16, 24, 32, 48. Related things sit 8–12px apart; groups 24–32px apart.
- **Plain words.** "AI app on this computer", not "local inference endpoint". If a term would need explaining to a non-technical friend, replace it or tuck it under "Advanced".
- **Status is text plus a shape, never colour alone.**
- **Dark mode is designed, not inverted:** three surface levels, borders doing the separating, shadows minimal, accent used sparingly.
- **Motion explains, then gets out of the way.** About 120ms for presses, 180ms for tabs and toggles, 260ms for sheets and dialogs; no bounce. Honour reduced motion.
- **Advanced settings exist, behind one clearly labelled disclosure.**

## Interaction rules

- Every action answers within 100ms: a pressed state, a spinner inside the button, or a status line. No silent clicks.
- Errors say what happened, why if known, and what to do next. "CareerOS couldn't reach Ollama. It may be closed. Open Ollama, then press Try again."
- Keep what is already on screen while something loads. Skeletons for first load; no full-page spinners; no layout jump when data arrives.
- Never lose typing. Validation runs after the person leaves a field, and a failed submit keeps every value.
- Back and Forward work. Filters, selection, scroll position, and wizard answers survive navigating away and back.
- Destructive actions confirm and, where practical, offer Undo.
- Everything works by keyboard with a visible focus ring; Escape closes sheets and dialogs and returns focus to what opened them; touch targets are at least 44px on phones.

## Technical realities to design around

- The live site is `https://…github.io`. A browser page there can only talk to an AI app on `127.0.0.1` if that app allows the site's origin, and current Chrome may also ask the person to allow access to local network devices. Confirm the exact behaviour in today's Chrome and with the installed Ollama and LM Studio versions, then design the "refused" state around it, with the precise setting to change for each app and operating system. The extension can be granted access to those addresses directly, so it may succeed where the page cannot; if so, offer it as the easier route.
- Check each app's real model-list address and response shape against the installed version before relying on it, and reuse the adapters in `src/features/ai/`.
- Calling `SpeechRecognition.available()` crashes some Chromium builds. Do not call it.
- Heavy code (PDF, MediaPipe, any model runtime) stays lazy-loaded.
- Keep the existing storage approach and its migration path. Existing records must survive. Backups never contain credentials.

## How to work

Do one milestone at a time, finish it properly, then stop and report before starting the next. A smaller amount that truly works is worth more than broad scaffolding.

Order:
1. Finish the theme and token migration for the remaining light-only stylesheets and the extension.
2. Home panel and connected status strip.
3. Connect sheet with consented detection and a real test.
4. Install helper.
5. Cloud cards with honest setup states.
6. Autopilot page with working Pause and Stop.
7. AutoApply layout and extension polish.
8. Full accessibility, responsive, and regression pass.

For every screen you build or change:
1. Open it in a real browser. Look at it in light and dark, at 375px, 768px, and 1440px (extension at 320–450px).
2. Write down what is weak: hierarchy, spacing, alignment, wording, contrast, anything that draws the eye to the wrong place.
3. Fix it and look again. Repeat until you would be comfortable showing it to a designer.
4. Use it: keyboard only, then as a first-time user. Remove any step that isn't needed.
5. Add tests: behaviour, the contrast audit in both themes, and no horizontal scrolling at 320px.

Before reporting a milestone, run lint, typecheck, unit tests, the Playwright suite, the production build, and the extension build, and tell me the real numbers, including anything skipped or failing.

In the report, label each feature as one of: working and verified with a real provider, working and verified with a simulated provider, built but not verified, blocked (and by what), or not started. Include before and after screenshots of real rendered pages, what you changed and why in plain language, and what you would improve next. If something in this brief turns out to be wrong, impossible, or a bad idea, say so and propose the better option rather than building it anyway.
