# CareerOS AutoApply — Setup, Architecture, Security & Extension Guide

## 1. Overview

**CareerOS AutoApply** is a privacy-conscious, human-in-the-loop job application autofill and tracking system built for **ProfessionalDev CareerOS**. It combines:

- **CareerOS Web Workspace (`/autoapply`)**: Batch job-link importer (1–20 links per batch), URL normalization & deduplication, platform & support-level classification, job-requirement matching, One-Page ATS Résumé selection (`Page Fit: 1 of 1` verified via Résumé Studio 3.0), Grounded Application Question Assistant (supporting Local AI via Ollama / LM Studio / OpenAI-compatible endpoints or deterministic profile-evidence synthesis), Field-Level Profile Sharing Consent, and Verified Submission History synced with CareerOS Application Tracker (`/applications`).
- **Chrome / Edge Manifest V3 Extension (`apps/extension/`)**: Background service worker (`background.ts`), form-inspection & autofill content script (`content.ts`), compact Popup (`popup/`), 6-step Side Panel Copilot (`sidepanel/`), and Privacy & Diagnostics Options page (`options/`).
- **Synthetic Application Sandbox (`/autoapply/sandbox`)**: Safe local E2E testing harness simulating single-page and multi-step employer portals (`generic`, `greenhouse`, `lever`, `ashby`, `workday`, `unsupported`), React-controlled inputs, custom selects, file uploads, open-ended questions, sensitive EEO/visa/work-authorization fields, validation errors, and submission confirmation banners.

---

## 2. Building & Loading the Unpacked Extension in Chrome / Edge

### Build the Extension

From the repository root (`C:\Users\eskew\github\professionaldev`):

```bash
npm run ext:build
npm run ext:typecheck
```

This bundles the Manifest V3 extension into:
- `apps/extension/dist`
- `apps/extension/.output/chrome-mv3`

### Load Unpacked in Chrome or Microsoft Edge

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select `C:\Users\eskew\github\professionaldev\apps\extension\dist`.
5. Pin **CareerOS AutoApply** to the browser toolbar.

---

## 3. Website–Extension Communication & Security Model

### Dual-Transport Versioned Protocol (`careeros-autoapply` v1.0)

CareerOS communicates with the extension using a versioned schema (`packages/careeros-shared/schemas/index.ts`):

1. **`externally_connectable` (`chrome.runtime.sendMessage`)**: Allowed only from:
   - `https://eskinder185.github.io/professionaldev/*`
   - `http://127.0.0.1/*`
   - `http://localhost/*`
2. **Authorized Content-Script Bridge (`CAREEROS_AUTOAPPLY_REQ` / `CAREEROS_AUTOAPPLY_RES`)**: Validates `validateSenderOrigin(window.location.href)` (requiring `https://eskinder185.github.io` or `localhost`/`127.0.0.1` and path prefix `/professionaldev`) before relaying messages to the extension background worker.
3. **Manual JSON Export/Import Fallback**: Users can export or import a portable `careeros-autoapply` JSON bundle at any time.

### Supported Protocol Actions

- `HANDSHAKE`
- `GET_CAPABILITIES`
- `IMPORT_QUEUE`
- `TRANSFER_PROFILE`
- `PREPARE_APPLICATION`
- `GET_APPLICATION_STATUS`
- `UPDATE_APPLICATION_STATUS`
- `CLEAR_SHARED_DATA`
- `INSPECT_CURRENT_FORM`
- `EXECUTE_AUTOFILL`
- `CONFIRM_SUBMISSION`

---

## 4. Privacy, Safety & Human-in-the-Loop Guarantees

1. **Minimal Permissions**: Requests only `activeTab`, `scripting`, `storage`, and `sidePanel`.
2. **Explicit Field-Level Consent**: Only profile fields checked by the user in `Extension Connection & Profile Consent` are included in `SharedProfileSubset`. Unconsented fields are rejected by `validateSharedProfileSubset`.
3. **Zero API Key Exposure**: Local AI / OpenAI API keys remain exclusively in CareerOS React memory (`AIConnectionProvider`) and are never transmitted to content scripts or extension storage.
4. **Anti-Fabrication & Sensitive Question Guard**:
   - Work authorization, visa sponsorship, criminal history, EEO/demographic self-identification, veteran/disability status, background-check consent, salary expectations, security clearance, and legal signatures are classified as `sensitive_manual` (`Requires Direct User Input`) and are **never** auto-answered.
   - AI-drafted answers are validated by `validateAIQuestionDraftOutput`, which blocks any number or metric not present verbatim in the user's verified Master Profile.
5. **No Blind Submission**:
   - AutoApply never clicks the employer's final Submit button automatically.
   - An application cannot transition to `Submitted and verified` merely because autofill ran; `CONFIRM_SUBMISSION` / `confirmationVerified: true` is required.

---

## 5. Platform Support & Known Limitations

| Platform | Support Level | Capabilities & Notes |
| :--- | :--- | :--- |
| **Generic HTML Forms** | `Supported` | Full semantic field discovery, React-controlled input autofill, read-back verification, and confirmation detection. |
| **Greenhouse** (`boards.greenhouse.io`, `job-boards.greenhouse.io`) | `Supported` | First/Last name, email, phone, location, LinkedIn/GitHub/website, school/degree/major, resume file input detection, and custom question textareas. |
| **Lever** (`jobs.lever.co`) | `Supported` | Full name, email, phone, current company, location, links, additional information, and custom application questions. |
| **Ashby** (`jobs.ashbyhq.com`) | `Partial` | Guided field detection, standard contact/link autofill, and copy-paste checklist fallback for custom dynamic widgets. |
| **Workday** (`*.myworkdayjobs.com`) | `Partial` | Multi-step guided mode with copy-paste checklist fallback; never attempts to bypass Workday account login walls. |
| **Gated / Login-Wall Portals** (LinkedIn Easy Apply, Indeed, Glassdoor) | `Unsupported` | Flagged as `Unsupported` upon import; provides a one-click Copyable Profile & Answer Checklist so the user is never stranded. |

---

## 6. Chrome Web Store Readiness & Browser Compatibility

- **Manifest V3 Compliant**: Service-worker state is persisted in `chrome.storage.local` (`apps/extension/src/storage/stateStore.ts`), surviving MV3 service-worker suspension and restarts without data loss.
- **No Remote Code Execution**: All code is bundled locally via `esbuild` into `apps/extension/dist` with zero external script CDNs.
- **Browser Compatibility**:
  - **Google Chrome & Microsoft Edge (Chromium)**: Full support (`action` popup, `sidePanel`, `scripting`, `storage`, `externally_connectable`).
  - **Brave**: Full support when localhost/extension messaging is permitted.
  - **Firefox**: Requires WebExtensions `sidebar_action` adaptation if ported in a future milestone.
