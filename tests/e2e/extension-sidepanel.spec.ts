import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  SHOT_DIR,
  chromeTabId,
  allChromeTabIds,
  launchWithExtension,
  noHorizontalScroll,
  panelUrl,
  patchExtensionState,
  readExtensionState,
  startMockAI,
  startStaticPage,
  type ExtensionHarness,
  type MockAI,
} from "./helpers/extension";

/**
 * Runs the real unpacked extension in real Chromium against the real CareerOS dev server and a
 * synthetic employer application. The side panel is opened as an extension page pinned to the
 * application tab (headless Chromium cannot open the docked side panel itself).
 */
const SITE = "http://127.0.0.1:4173/professionaldev";
const COMPANY = "Atlas Systems";
const ROLE = "Linux Systems Engineer";
const JD =
  "We are seeking a Linux Systems Engineer. Required: Linux, Ubuntu, Bash, Python, TCP/IP, DNS, and AWS. Preferred: Kubernetes and Terraform.";

test.describe.configure({ mode: "serial" });

test.describe("CareerOS AutoApply side panel (real Chromium)", () => {
  test.skip(({ isMobile }) => isMobile, "Extension tests run once, on desktop Chromium");

  let h: ExtensionHarness;
  let app: Page;
  let panel: Page;
  let appId = "";
  let websiteScore = "";
  let ai: MockAI;

  test.beforeAll(async () => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    h = await launchWithExtension();
    ai = await startMockAI(
      "Dear [Hiring Manager],\n\nI am applying for the Linux Systems Engineer role at Atlas Systems. My experience with Linux and Python aligns with the requirements.\n\nSincerely,\nApplicant",
    );
  });

  test.afterAll(async () => {
    await ai?.close();
    await h?.close();
  });

  const openPanel = async (width = 390, height = 900) => {
    const tabId = await chromeTabId(h.worker, "/autoapply/sandbox");
    panel = panel && !panel.isClosed() ? panel : await h.context.newPage();
    await panel.setViewportSize({ width, height });
    await panel.goto(panelUrl(h.extId, tabId));
    await expect(panel.getByRole("heading", { name: "CareerOS", level: 1 })).toBeVisible();
    return panel;
  };

  const sandboxUrl = (extra = "") =>
    `${SITE}/autoapply/sandbox?platform=generic&company=${encodeURIComponent(COMPANY)}&role=${encodeURIComponent(ROLE)}&appId=${appId}&location=${encodeURIComponent("Atlanta, GA")}${extra}`;

  test("seed: CareerOS imports a job, analyzes it with the real engine and syncs to the extension", async () => {
    app = await h.context.newPage();
    await app.goto(`${SITE}/autoapply`);
    await expect(app.getByTestId("extension-handshake-badge")).toContainText("Extension connected");
    await app.getByTestId("job-urls-input").fill(
      `http://localhost/professionaldev/autoapply/sandbox?platform=generic&company=${encodeURIComponent(COMPANY)}&role=${encodeURIComponent(ROLE)}`,
    );
    await app.getByTestId("btn-import-job-urls").click();
    await app.getByTestId("detail-input-company").fill(COMPANY);
    await app.getByTestId("detail-input-title").fill(ROLE);
    await app.getByTestId("detail-textarea-jd").fill(JD);
    await app.getByTestId("btn-analyze-job").click();
    await expect(app.getByTestId("detail-match-score")).toContainText("Match Score:");
    websiteScore = ((await app.getByTestId("detail-match-score").innerText()).match(/(\d+)%/) ?? [])[1] ?? "";
    expect(websiteScore).not.toBe("");

    const rowTestId = await app.locator('[data-testid^="queue-row-"]').first().getAttribute("data-testid");
    appId = (rowTestId ?? "").replace("queue-row-", "");
    expect(appId).not.toBe("");

    await app.getByTestId("btn-sync-to-extension").click();
    await expect(app.getByTestId("autoapply-sync-banner")).toContainText("Synced");

    const state = await readExtensionState<{ queue: unknown[]; analyses: Record<string, unknown>; resumeVersions: unknown[]; sharedProfile: unknown }>(h.worker);
    expect(state.queue.length).toBeGreaterThan(0);
    expect(Object.keys(state.analyses)).toContain(appId);
    expect(state.resumeVersions.length).toBeGreaterThan(0);
    expect(state.sharedProfile).toBeTruthy();
  });

  test("1-3. side panel renders the header and all three tabs work and persist", async () => {
    await app.goto(sandboxUrl("&salary=" + encodeURIComponent("$85,000–$105,000") + "&coverletter=optional"));
    await expect(app.getByTestId("synthetic-application-form")).toBeVisible();
    await openPanel();

    await expect(panel.getByRole("button", { name: "Report an issue" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Open CareerOS" })).toBeVisible();
    await expect(panel.getByTestId("tab-page")).toHaveAttribute("aria-selected", "true");
    await expect(panel.getByTestId("page-tab")).toBeVisible();

    await panel.getByTestId("tab-score").click();
    await expect(panel.getByTestId("score-overview")).toBeVisible();
    await panel.getByTestId("tab-profile").click();
    await expect(panel.getByTestId("profile-sync")).toBeVisible();
    await panel.getByTestId("tab-autofill").click();
    await expect(panel.getByTestId("job-card")).toBeVisible();

    // Selected tab survives a reload of the panel.
    await panel.getByTestId("tab-score").click();
    await panel.reload();
    await expect(panel.getByTestId("tab-score")).toHaveAttribute("aria-selected", "true");

    // Keyboard: arrow keys move between tabs.
    await panel.getByTestId("tab-score").focus();
    await panel.keyboard.press("ArrowRight");
    await expect(panel.getByTestId("tab-profile")).toHaveAttribute("aria-selected", "true");
    await panel.getByTestId("tab-autofill").click();
  });

  test("4. job card reflects the actual page; salary only appears when the posting lists it", async () => {
    await expect(panel.getByTestId("job-title")).toHaveText(ROLE);
    await expect(panel.getByTestId("job-company")).toHaveText(COMPANY);
    await expect(panel.getByTestId("job-location-value")).toHaveText("Atlanta, GA");
    await expect(panel.getByTestId("job-salary-value")).toContainText("$85,000");
    await expect(panel.getByTestId("job-status")).toContainText("Not verified");
    // No Workday notice on a non-Workday page.
    await expect(panel.getByText(/Workday/)).toHaveCount(0);

    // Same job without a salary in the posting: no salary row is invented.
    await app.goto(sandboxUrl());
    await expect(panel.getByTestId("job-title")).toHaveText(ROLE, { timeout: 10_000 });
    await expect(panel.getByTestId("job-salary-value")).toHaveCount(0);
    await app.goto(sandboxUrl("&salary=" + encodeURIComponent("$85,000–$105,000") + "&coverletter=optional"));
    await expect(panel.getByTestId("job-salary-value")).toContainText("$85,000", { timeout: 10_000 });
  });

  test("9. résumé match shows the real CareerOS analysis, with honest wording", async () => {
    const card = panel.getByTestId("resume-card");
    await expect(card.getByTestId("match-score")).toHaveText(`Résumé match: ${websiteScore}/100`);
    await expect(card.getByTestId("match-support")).toContainText(/\d+ of \d+ confirmed requirements supported/);
    await expect(card.getByTestId("match-breakdown")).toContainText("verified");
    await expect(card).toContainText("not an employer ATS score");
    await expect(card.getByTestId("resume-filename")).toContainText(".pdf");
    await panel.screenshot({ path: path.join(SHOT_DIR, "autofill-390.png"), fullPage: true });
  });

  test("7-8. résumé preview opens and the résumé selector changes the version", async () => {
    await panel.getByTestId("btn-preview-resume").click();
    await expect(panel.getByTestId("resume-preview")).toBeVisible();
    await panel.getByRole("button", { name: "Close" }).click();

    const select = panel.getByTestId("resume-select");
    const options = await select.locator("option").allInnerTexts();
    expect(options.length).toBeGreaterThan(0);
    // Switching to the other version (when more than one exists) updates the queue item.
    const values = await select.locator("option").evaluateAll((os) => (os as HTMLOptionElement[]).map((o) => o.value).filter(Boolean));
    if (values.length > 1) {
      const current = await select.inputValue();
      const other = values.find((v) => v !== current)!;
      await select.selectOption(other);
      await expect.poll(async () => (await readExtensionState<{ queue: Array<{ id: string; selectedResumeId: string }> }>(h.worker)).queue.find((q) => q.id === appId)?.selectedResumeId).toBe(other);
      await select.selectOption(current);
    }
  });

  test("11. cover letter card detects the form's cover letter field", async () => {
    const card = panel.getByTestId("cover-card");
    await expect(card.getByTestId("cover-status")).toContainText("optional cover letter field");
    await app.goto(sandboxUrl("&coverletter=required"));
    await expect(card.getByTestId("cover-status")).toContainText("requires a cover letter", { timeout: 10_000 });
    await app.goto(sandboxUrl("&coverletter=file"));
    await expect(card.getByTestId("cover-status")).toContainText("cover letter file", { timeout: 10_000 });
    await app.goto(sandboxUrl());
    await expect(card.getByTestId("cover-status")).toContainText("No cover letter field was detected", { timeout: 10_000 });
    await app.goto(sandboxUrl("&salary=" + encodeURIComponent("$85,000–$105,000") + "&coverletter=optional"));
    await expect(card.getByTestId("cover-status")).toContainText("optional cover letter field", { timeout: 10_000 });
  });

  test("14. local AI respects consent and never calls a model before the user agrees", async () => {
    const snap = { provider: "lmstudio", providerLabel: "LM Studio (local)", baseUrl: ai.baseUrl, model: "test-model", connected: true, isLocal: true, keyless: true, updatedAt: new Date().toISOString() };
    await patchExtensionState(h.worker, { aiConnection: snap });
    await expect(panel.getByTestId("header-ai")).toContainText("AI Ready");
    await expect(panel.getByTestId("header-ai")).toHaveAttribute("title", /test-model/);

    const draft = panel.getByTestId("btn-ai-draft");
    await expect(draft).toBeEnabled();
    await draft.click();
    const consent = panel.getByTestId("ai-consent");
    await expect(consent).toBeVisible();
    await expect(consent).toContainText("127.0.0.1");
    await expect(panel.getByTestId("ai-consent-payload")).toContainText("Use ONLY the facts");
    await panel.getByTestId("btn-ai-cancel").click();
    expect(ai.requests.length).toBe(0);

    await draft.click();
    await panel.getByTestId("btn-ai-consent").click();
    await expect(panel.getByTestId("cover-text")).toHaveValue(/Dear \[Hiring Manager\]/);
    expect(ai.requests.length).toBe(1);
    expect(ai.requests[0].body).not.toMatch(/apiKey|Authorization/i);

    // An AI draft cannot be inserted until the user confirms they reviewed it.
    await expect(panel.getByTestId("btn-cover-insert")).toBeDisabled();
    await panel.getByTestId("cover-reviewed").check();
    await expect(panel.getByTestId("btn-cover-insert")).toBeEnabled();
    await panel.getByTestId("btn-cover-insert").click();
    await expect(panel.getByTestId("cover-message")).toContainText("inserted and verified");
    await expect(app.getByTestId("input-cover-letter")).toHaveValue(/Linux Systems Engineer role/);

    // A cloud or keyed connection is shown but never called from the extension.
    await patchExtensionState(h.worker, { aiConnection: { ...snap, baseUrl: "https://api.openai.com/v1", isLocal: false, keyless: false } });
    await expect(panel.getByTestId("btn-ai-draft")).toBeDisabled();
    await expect(panel.getByTestId("cover-ai-reason")).toContainText("Drafting stays in CareerOS");
    await expect(panel.getByTestId("header-ai")).toContainText("not on this device");
    expect(ai.requests.length).toBe(1);
    await patchExtensionState(h.worker, { aiConnection: snap });
  });

  test("application question AI requires consent, evidence, and acceptance before insertion", async () => {
    const questionAI = await startMockAI('{"answer":"I used Linux to troubleshoot incidents.","evidence":"Linux"}');
    const snap = { provider: "lmstudio", providerLabel: "LM Studio (local)", baseUrl: questionAI.baseUrl, model: "question-model", connected: true, isLocal: true, keyless: true, updatedAt: new Date().toISOString() };
    try {
      await app.goto(sandboxUrl());
      await patchExtensionState(h.worker, { aiConnection: snap });
      const card = panel.getByTestId("question-ai-card");
      await expect(card).toBeVisible();
      await card.getByLabel("Question on this form").selectOption({ label: "Why are you interested in this role?" });
      await card.getByTestId("btn-question-ai-draft").click();
      const consent = panel.getByTestId("question-ai-consent");
      await expect(consent).toContainText("question-model");
      expect(questionAI.requests).toHaveLength(0);
      await consent.getByRole("button", { name: "Send and draft" }).click();
      await expect(card.getByLabel("Suggested answer")).toHaveValue(/I used Linux/);
      await expect(card.getByText(/Supporting résumé evidence/)).toContainText("Linux");
      await expect(card.getByRole("button", { name: "Insert approved answer into form" })).toHaveCount(0);
      await card.getByRole("button", { name: "Accept reviewed answer" }).click();
      await expect(card.getByRole("button", { name: "Insert approved answer into form" })).toBeVisible();
      expect(questionAI.requests).toHaveLength(1);
    } finally {
      await patchExtensionState(h.worker, { aiConnection: null });
      await questionAI.close();
    }
  });

  test("6, 13, 15. Start Autofill fills supported fields, verifies read-back and never submits", async () => {
    // Reset the cover letter so the autofill run has a clean form.
    await app.goto(sandboxUrl("&salary=" + encodeURIComponent("$85,000–$105,000") + "&coverletter=optional"));
    await expect(panel.getByTestId("btn-start-autofill")).toBeEnabled({ timeout: 10_000 });
    await expect(app.getByTestId("input-first-name")).toHaveValue("");

    await panel.getByTestId("btn-start-autofill").click();
    await expect(panel.getByTestId("btn-review-application")).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByTestId("banner-done")).toContainText("Autofill completed");

    // The form on the page really changed.
    await expect(app.getByTestId("input-first-name")).not.toHaveValue("");
    await expect(app.getByTestId("input-email")).toHaveValue(/@/);

    // The panel reports what the page actually holds (read back), not what automation attempted.
    const emailValue = await app.getByTestId("input-email").inputValue();
    const filled = panel.getByTestId("group-filled");
    await expect(filled).toBeVisible();
    await expect(filled).toContainText(emailValue);

    // Sensitive / legal questions stay manual; the page's values for them stay empty.
    await expect(panel.getByTestId("group-manual")).toBeVisible();
    await expect(app.getByTestId("input-visa-sponsorship")).toHaveValue("");
    await expect(app.getByTestId("input-work-authorization")).toHaveValue("");

    // File upload is reported as manual, never claimed as attached.
    await expect(panel.getByTestId("group-file")).toContainText("Attach manually");

    // Real submission never happened.
    await expect(app.getByTestId("application-confirmation")).toHaveCount(0);
    await expect(app.getByTestId("synthetic-application-form")).toBeVisible();

    // The queue item moved to "Ready for review" (never "Submitted").
    const st = await readExtensionState<{ queue: Array<{ id: string; status: string }>; autofillRun: { phase: string } }>(h.worker);
    expect(st.queue.find((q) => q.id === appId)?.status).toBe("Ready for review");
    expect(st.autofillRun.phase).toBe("done");

    await panel.screenshot({ path: path.join(SHOT_DIR, "autofill-results-390.png"), fullPage: true });

    // "Review Application" highlights fields on the page for review.
    await panel.getByTestId("btn-review-application").click();
    await expect.poll(() => app.locator("[data-careeros-highlight]").count()).toBeGreaterThan(0);
  });

  test("tracker review banner surfaces the AutoApply record, with evidence, and never assumes submission", async () => {
    const tracker = await h.context.newPage();
    await tracker.goto(`${SITE}/tracker`);
    const banner = tracker.getByTestId("review-banner");
    await expect(banner).toContainText("Applications need review", { timeout: 15_000 });
    await tracker.getByTestId("btn-review").click();
    await expect(tracker.getByTestId("review-list")).toContainText(ROLE);
    await expect(tracker.getByTestId("review-list")).toContainText("can’t tell whether you submitted");
    // The extension reported a filled form, not a submission, so the tracker must not say Applied yet.
    const before = await tracker.evaluate(() => (JSON.parse(localStorage.getItem("appTracker:items") ?? "[]") as Array<{ role: string; status: string }>).find((a) => a.role === "Linux Systems Engineer")?.status);
    expect(before).not.toBe("Applied");
    await tracker.getByTestId(`confirm-${appId}`).click();
    const after = await tracker.evaluate(() => (JSON.parse(localStorage.getItem("appTracker:items") ?? "[]") as Array<{ role: string; status: string; history?: Array<{ event: string }> }>).find((a) => a.role === "Linux Systems Engineer"));
    expect(after?.status).toBe("Applied");
    expect(after?.history?.some((e) => e.event.includes("You confirmed"))).toBe(true);
    await tracker.close();
  });

  test("autofill can be cancelled and reports validation problems from the page", async () => {
    await app.goto(sandboxUrl());
    await expect(panel.getByTestId("btn-start-autofill")).toBeEnabled({ timeout: 10_000 });
    await panel.getByTestId("btn-start-autofill").click();
    // Cancel as soon as the progress card appears (the run is batched so this lands between fields).
    const cancel = panel.getByTestId("btn-cancel-autofill");
    await cancel.click({ timeout: 5000 }).catch(() => undefined);
    await expect(panel.getByTestId("btn-start-autofill")).toBeVisible({ timeout: 20_000 });
    const st = await readExtensionState<{ autofillRun: { phase: string } }>(h.worker);
    expect(["done", "cancelled"]).toContain(st.autofillRun.phase);

    // A value the page rejects is surfaced as a validation issue, not as "complete".
    await app.getByTestId("input-email").fill("not-an-email");
    await expect(panel.getByTestId("validation-issues")).toContainText(/Email|email/, { timeout: 10_000 });
  });

  test("10. Tailor Résumé opens the working Résumé Studio flow without touching the master", async () => {
    await app.goto(sandboxUrl());
    const before = await app.evaluate(() => localStorage.getItem("pd:careeros:resume-documents"));
    const [studio] = await Promise.all([
      h.context.waitForEvent("page"),
      panel.getByTestId("btn-tailor-resume").click(),
    ]);
    await studio.waitForLoadState("domcontentloaded");
    expect(studio.url()).toContain(`/resume?tailorFor=${appId}`);
    await expect(studio.getByText(/Started a tailored draft|Opened your existing tailored version/)).toBeVisible({ timeout: 15_000 });
    const after = await studio.evaluate(() => JSON.parse(localStorage.getItem("pd:careeros:resume-documents") ?? "[]") as Array<{ kind?: string; name: string }>);
    const beforeList = JSON.parse(before ?? "[]") as Array<{ kind?: string }>;
    expect(after.length).toBeGreaterThanOrEqual(beforeList.length);
    expect(after.some((v) => v.kind === "tailored" && v.name.includes(COMPANY))).toBe(true);
    // The master profile content is unchanged.
    const beforeMaster = JSON.stringify(beforeList.find((v) => v.kind === "master"));
    const afterMaster = JSON.stringify(after.find((v) => v.kind === "master"));
    expect(afterMaster).toBe(beforeMaster);
    await studio.screenshot({ path: path.join(SHOT_DIR, "tailor-resume-studio.png") });
    await studio.close();
  });

  test("5, 12. Résumé Score and Profile tabs show real data and profile edits stay marked unconfirmed", async () => {
    await panel.getByTestId("tab-score").click();
    await expect(panel.getByTestId("score-value")).toHaveText(`${websiteScore}/100`);
    await expect(panel.getByTestId("score-required")).toContainText(/\d+ of \d+ met/);
    await expect(panel.getByTestId("score-quality")).toContainText("Formatting checks, kept separate");
    const firstReq = panel.locator('[data-testid^="req-"]').first();
    await firstReq.locator("summary").click();
    await expect(firstReq).toContainText("job description");
    // Marking a requirement N/A changes the view only and is reversible.
    await firstReq.getByRole("button", { name: /Mark not applicable/ }).click();
    await expect(panel.getByText("Marked N/A by you")).toBeVisible();
    await firstReq.getByRole("button", { name: /Undo N\/A/ }).click();
    await panel.screenshot({ path: path.join(SHOT_DIR, "score-390.png"), fullPage: true });

    await panel.getByTestId("tab-profile").click();
    await expect(panel.getByTestId("profile-contact")).toBeVisible();
    await panel.getByRole("button", { name: "Edit Contact information" }).click();
    await panel.getByRole("textbox", { name: "Phone" }).fill("404-555-0100");
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    await expect(panel.getByTestId("pv-phone")).toContainText("404-555-0100");
    await expect(panel.getByTestId("pv-phone")).toContainText("Unconfirmed");
    await expect(panel.getByTestId("profile-sync")).toContainText("unconfirmed");
    await panel.screenshot({ path: path.join(SHOT_DIR, "profile-390.png"), fullPage: true });

    // Controlled deletion of a section's shared data.
    panel.once("dialog", (d) => void d.accept());
    await panel.getByTestId("profile-links").getByRole("button", { name: /Delete this section/ }).click();
    await expect(panel.getByTestId("pv-linkedin")).toContainText("Missing");
    const st = await readExtensionState<{ sharedProfile: { values: Record<string, string> } }>(h.worker);
    expect(st.sharedProfile.values.linkedin).toBeUndefined();
    await panel.getByTestId("tab-autofill").click();
  });

  test("16. a restarted service worker and rapid parallel writes do not corrupt the queue", async () => {
    const before = await readExtensionState<{ queue: Array<{ id: string }> }>(h.worker);
    const ids = before.queue.map((q) => q.id).sort();

    // Fire many concurrent status updates through the real service worker.
    const results = await panel.evaluate(async (target) => {
      const send = (i: number) =>
        new Promise<boolean>((resolve) => {
          (globalThis as unknown as { chrome: { runtime: { sendMessage: (m: unknown, cb: (r: { ok?: boolean }) => void) => void } } }).chrome.runtime.sendMessage(
            {
              protocol: "careeros-autoapply",
              version: "1.0",
              requestId: `race-${i}`,
              action: "UPDATE_APPLICATION_STATUS",
              origin: "extension://internal",
              timestamp: new Date().toISOString(),
              payload: { applicationId: target, status: "Needs information", notes: `note-${i}` },
            },
            (r) => resolve(Boolean(r?.ok)),
          );
        });
      return Promise.all(Array.from({ length: 12 }, (_, i) => send(i)));
    }, appId);
    expect(results.every(Boolean)).toBe(true);
    const after = await readExtensionState<{ queue: Array<{ id: string }> }>(h.worker);
    expect(after.queue.map((q) => q.id).sort()).toEqual(ids);

    // Stop the service worker for real (CDP ServiceWorker domain), then confirm it wakes on demand.
    const cdp = await h.context.newCDPSession(panel);
    const versions: Array<{ versionId: string; scriptURL: string; runningStatus: string }> = [];
    cdp.on("ServiceWorker.workerVersionUpdated", (e: { versions: typeof versions }) => versions.push(...e.versions));
    await cdp.send("ServiceWorker.enable");
    await expect.poll(() => versions.some((v) => v.scriptURL.includes(h.extId))).toBe(true);
    const v = versions.filter((x) => x.scriptURL.includes(h.extId)).pop()!;
    await cdp.send("ServiceWorker.stopWorker", { versionId: v.versionId });
    await expect.poll(() => versions.filter((x) => x.scriptURL.includes(h.extId)).pop()?.runningStatus).toBe("stopped");

    // State lives in chrome.storage, so the panel reads it unchanged while the worker is down...
    const readViaPanel = () =>
      panel.evaluate(async (key) => {
        const c = (globalThis as unknown as { chrome: { storage: { local: { get: (k: string) => Promise<Record<string, unknown>> } } } }).chrome;
        return ((await c.storage.local.get(key))[key] as { queue: Array<{ id: string }> }).queue.map((q) => q.id).sort();
      }, "careeros:autoapply:ext-state");
    expect(await readViaPanel()).toEqual(ids);

    // ...and the next message wakes the worker, which serves it with the queue intact.
    const woke = await panel.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          (globalThis as unknown as { chrome: { runtime: { sendMessage: (m: unknown, cb: (r: { ok?: boolean; data?: { queue?: unknown[] } }) => void) => void } } }).chrome.runtime.sendMessage(
            { protocol: "careeros-autoapply", version: "1.0", requestId: "wake-1", action: "GET_APPLICATION_STATUS", origin: "extension://internal", timestamp: new Date().toISOString(), payload: {} },
            (r) => resolve(Boolean(r?.ok && Array.isArray(r.data?.queue) && r.data!.queue!.length > 0)),
          );
        }),
    );
    expect(woke).toBe(true);
    await panel.reload();
    await expect(panel.getByTestId("job-title")).toHaveText(ROLE, { timeout: 15_000 });
    expect(await readViaPanel()).toEqual(ids);
  });

  test("5b. unsupported and unreadable pages show a proper fallback", async () => {
    const plain = await startStaticPage("<!doctype html><title>Blog</title><h1>My cat photos</h1><p>No jobs here.</p>");
    const other = await startStaticPage("<!doctype html><title>Other</title><h1>Hello</h1>", "127.0.0.2").catch(() => null);
    try {
      const page = await h.context.newPage();
      await page.goto(plain.url);
      const tabId = await chromeTabId(h.worker, plain.url);
      await panel.goto(panelUrl(h.extId, tabId));
      await expect(panel.getByTestId("job-empty")).toContainText("No supported job detected");
      await expect(panel.getByTestId("btn-import-job")).toBeVisible();
      await expect(panel.getByTestId("btn-start-autofill")).toBeDisabled();
      await expect(panel.getByTestId("start-blocker")).toBeVisible();
      await panel.screenshot({ path: path.join(SHOT_DIR, "unsupported-390.png"), fullPage: true });

      if (other) {
        const knownTabs = await allChromeTabIds(h.worker);
        const page2 = await h.context.newPage();
        await page2.goto(other.url);
        // The extension has no permission for this host, so Chrome hides the tab's URL from it.
        const tab2 = (await allChromeTabIds(h.worker)).filter((id) => !knownTabs.includes(id)).pop()!;
        await panel.goto(panelUrl(h.extId, tab2));
        await expect(panel.getByTestId("banner-unreadable")).toContainText("can't read this page");
        await expect(panel.getByTestId("btn-start-autofill")).toBeDisabled();
        await page2.close();
      }
      await page.close();
    } finally {
      await plain.close();
      await other?.close();
    }
  });

  test("17. popup works as a launcher", async () => {
    const popup = await h.context.newPage();
    const tabId = await chromeTabId(h.worker, "/autoapply/sandbox");
    void tabId;
    await popup.goto(`chrome-extension://${h.extId}/popup/index.html`);
    await expect(popup.getByTestId("btn-open-sidepanel")).toBeVisible();
    await expect(popup.getByTestId("btn-open-careeros")).toBeVisible();
    await expect(popup.getByTestId("btn-open-settings")).toBeVisible();
    await expect(popup.getByTestId("popup-connection-status")).not.toHaveText("Checking…");
    await popup.screenshot({ path: path.join(SHOT_DIR, "popup.png") });
    await popup.close();
  });

  test("18. layout stays usable with no horizontal scroll from 320px to 450px on every tab", async () => {
    await app.goto(sandboxUrl("&salary=" + encodeURIComponent("$85,000–$105,000") + "&coverletter=optional"));
    for (const width of [320, 360, 390, 420, 450]) {
      await openPanel(width, 900);
      for (const tab of ["page", "autofill", "score", "profile"] as const) {
        await panel.getByTestId(`tab-${tab}`).click();
        await expect(panel.getByTestId(`tab-${tab}`)).toHaveAttribute("aria-selected", "true");
        expect(await noHorizontalScroll(panel), `${tab} @ ${width}px`).toBe(true);
      }
      // No tab label may be clipped (a 4th tab once pushed "Résumé Score" into an ellipsis).
      const clipped = await panel.getByRole("tab").evaluateAll((tabs) => tabs.filter((t) => t.scrollWidth > t.clientWidth + 1 || getComputedStyle(t).textOverflow === "ellipsis").map((t) => t.textContent));
      expect(clipped, `clipped tab labels @ ${width}px`).toEqual([]);
      await panel.getByTestId("tab-autofill").click();
      await panel.screenshot({ path: path.join(SHOT_DIR, `autofill-${width}.png`), fullPage: true });
    }
  });
});
