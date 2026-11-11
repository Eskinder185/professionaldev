# CareerOS Copilot: page access, privacy, and Chrome Web Store disclosure

This describes what the CareerOS extension can see, when, and what leaves the browser. It is written
to match the code in `apps/extension/` and to back the Chrome Web Store privacy disclosures.

## Two ways the extension reads a page

| Mode | How it starts | What it covers | Permission |
| --- | --- | --- | --- |
| **Analyze this page** | The person opens CareerOS (toolbar icon / side panel) on a page | That tab, until it navigates or closes | Chrome `activeTab`; nothing permanent |
| **Always assist on this site** | The person clicks the button in the side panel | One `https` origin, until turned off | Chrome's own prompt for that origin (`optional_host_permissions`) |

- Install-time permissions are `activeTab`, `scripting`, `storage`, `sidePanel`, plus host access for the
  CareerOS site, loopback (`127.0.0.1`/`localhost`, for local development and tests), and two applicant
  systems (Greenhouse, Lever). There is **no** all-sites access at install.
- "Always assist" asks for a single origin at a time, from a click, so Chrome shows its prompt.
  It registers a content script for that origin only. Turning it off removes the script and the permission.
  Removing the permission in `chrome://extensions` has the same effect: open tabs on that site are told to
  shut the page script down, and the saved list is reconciled whenever the service worker starts.
- Sites that handle money, mail, passwords, health or identity (banking, webmail, password managers,
  patient portals, government identity) are refused before Chrome is asked. Sites that restrict
  automated tools (for example LinkedIn, Indeed) are never requested; the person is told why.
- Cross-origin iframes cannot be read from the parent page. When a known applicant system is embedded,
  the panel says so and suggests opening the form in its own tab. Closed shadow roots are unreachable by design.

## What the extension reads

- The visible structure of the page the person asked it to look at: job title, company, location,
  employment type, salary only when the posting states it, the job description, and form fields.
- Each value carries where it came from. Anything not stated on the page stays blank; nothing is guessed.
- Typing into fields is not observed. The page watcher only fingerprints which fields exist, the heading and
  the address, is throttled, capped per minute, pauses when the tab is hidden and never polls on a timer.

## What is stored, and where

- `chrome.storage.local`: the profile the person approved for the extension, queue, preferences, and the
  list of sites they approved for ongoing access.
- `chrome.storage.session`: which open tabs currently have the page script (cleared when the browser closes).
- Nothing about the pages visited is kept beyond what the person saves to their own CareerOS tracker.

## What leaves the browser

- By default **nothing**. The résumé match is computed in the panel by the same rule-based engine as the
  CareerOS website. It is an internal estimate of overlap between the approved profile and the job
  description, not an ATS score, and it is shown as such.
- Local AI (Ollama, LM Studio) runs on the person's machine and is used only after they agree. Page text sent to a
  model is treated as untrusted data, never as instructions.
- Cloud AI is never used without explicit, per-provider consent, and is off in local-only mode.
- The extension does not sell data, serve ads, build profiles, or use page content for anything but the
  feature the person invoked (Chrome Web Store *limited use*).

## What the extension never does

- Submit an application, accept legal declarations, or answer sensitive questions (work authorisation,
  demographics, disability, criminal history, compensation history) without the person entering them.
- Fill a field it is not confident about. Only high-confidence, authorised fields are filled; every value
  is read back from the page afterwards and reported.
- Request all-sites access, use remote code, or run model output as code.

## Suggested store disclosure (single purpose)

> CareerOS AutoApply helps people complete job applications faster. On a page the person chooses (or a site
> they explicitly approve), it reads the job posting and form, estimates how the person's own approved
> profile matches, and fills fields the person has authorised. Page content is processed in the browser. It is
> sent to an AI model only when the person turns on an AI provider and agrees.

Data types touched: website content (job postings and form fields on pages the person chose), personally
identifiable information the person approved for autofill (name, contact details, experience), and
authentication-free local preferences. None is sold or transferred for unrelated purposes.

## Not yet covered by automated tests

See `copilot-manual-checks.md`.
