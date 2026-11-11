# CareerOS Quality & Defect Audit

## Executive Summary
This document provides a comprehensive defect classification and diagnostic log for the **ProfessionalDev CareerOS** web application and **CareerOS AutoApply** Chrome Extension prior to the functional repair and UI/UX overhaul.

All defects were audited across the full route surface:
- **Workspace Navigation & Dashboard**: `/dashboard`
- **Jobs & Matches Workspace**: `/jobs`, `/matches`
- **Résumé Studio 3.0**: `/resume`, `/resume/tailor`
- **Application Tracker**: `/applications`, `/tracker`
- **Interview Studio**: `/interviews`
- **Career Tools**: `/interview-sim`, `/elevator-pitch`, `/star-builder`
- **Documents**: `/documents`
- **Settings & Data Management**: `/settings`
- **Chrome / Edge Extension**: MV3 Side Panel, Popup, Sandbox Autofill

---

## Defect Inventory & Severity Classification

### 1. [CRITICAL] Browser Microphone Failure in Interview Tools
- **Affected Routes**: `/interview-sim`, `/interviews`, `/elevator-pitch`
- **Component Files**:
  - `src/hooks/useMediaRecorder.ts`
  - `src/components/Elevator/TeleprompterRecorder.tsx`
  - `src/features/interviews/SessionRoom.tsx`
- **Root Cause**:
  1. `useMediaRecorder.ts` hardcoded preferred MIME types to `video/webm;codecs=vp9,opus` and `video/webm`. When consumer pages (e.g., `InterviewSim.tsx`) requested audio-only recording (`{ audio: true }`), `MediaRecorder` attempted to instantiate with a video container on an audio-only MediaStream. In modern Chromium and WebKit browsers, this throws an unhandled `NotSupportedError` or fails to record data.
  2. In `TeleprompterRecorder.tsx`, `new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" })` was hardcoded without calling `MediaRecorder.isTypeSupported()`. If the browser or OS lacks VP9 encoding support (e.g. Safari / iOS), construction threw an exception that was generically caught as "Could not access camera or microphone", misleading users into believing permissions were blocked.
  3. `SessionRoom.tsx` did not decouple Web Speech API transcription from audio stream capture. When Web Speech API timed out or aborted in synthetic/offline environments, it conflated recording status with transcription status. Additionally, when `MediaRecorder` was instantiated, no MIME type negotiation was performed.
- **Reproduction Steps**:
  1. Navigate to `/interview-sim`.
  2. Check "Auto-record" and press "Start".
  3. Notice recorder error or failure to generate playable audio blob upon stop.
- **Impact**: Completely blocked voice interview simulation and audio playback review.

---

### 2. [HIGH] Unit Test Filter Regression in Jobs Module
- **Affected Test**: `tests/unit/jobs/jobs.test.ts > filters > composes and counts honestly`
- **Root Cause**:
  In test fixture setup, job `b` was created without an explicit `description`, triggering the test helper's default fallback description `"Linux and Bash."`. Consequently, filtering by `"linux"` returned both jobs `["a", "b"]` instead of the expected `["a"]`.
- **Reproduction Steps**:
  Run `npx vitest run tests/unit/jobs/jobs.test.ts`.
- **Impact**: Broke CI/CD unit test pass guarantees.

---

### 3. [HIGH] Settings Backup Export Name Contention & Silent Restore Hang
- **Affected Routes**: `/settings`
- **Component Files**:
  - `src/pages/Settings.tsx`
  - `tests/e2e/careeros.spec.ts`
  - `tests/e2e/storage-backup.spec.ts`
- **Root Cause**:
  1. In `Settings.tsx`, the primary export button was labeled "Export all data", whereas legacy test specs expected "Export my data".
  2. In modern CareerOS, restoring a backup provides a safety preview before committing. Legacy E2E tests expected file input selection to immediately trigger navigation without interacting with the "Restore verified backup" preview button.
- **Reproduction Steps**:
  Run `npx playwright test tests/e2e/storage-backup.spec.ts` and `tests/e2e/careeros.spec.ts:84`.
- **Impact**: Timed out backup verification tests.

---

### 4. [MEDIUM] Mobile Header Quick-Create Button Hidden
- **Affected Route**: Global Workspace Header on viewports `< 640px`
- **Component Files**:
  - `src/styles/careeros-polish.css`
  - `src/components/layout/WorkspaceShell.tsx`
- **Root Cause**:
  `careeros-polish.css` applied `.career-topbar .career-quick-create { display: none; }` at narrow breakpoints, preventing mobile users from quick-creating applications directly from the top bar.
- **Reproduction Steps**:
  Open viewport at 390px width and attempt to access "New application" from header.
- **Impact**: Mobile users could not access the quick application drawer without navigating to the Applications page.

---

### 5. [LOW] AudioContext Suspension on Modern Browsers
- **Affected Route**: `/interviews`
- **Component File**: `src/features/interviews/audioMeter.ts`
- **Root Cause**:
  `AudioContext` created in `startAudioMeter` can initialize in `"suspended"` state under browser autoplay policies, resulting in zero-level audio meter readings until a resume call occurs.
- **Reproduction Steps**:
  Start interview session without explicit prior interaction with the AudioContext.
- **Impact**: Audio level meter rendered flatline despite active microphone input.
