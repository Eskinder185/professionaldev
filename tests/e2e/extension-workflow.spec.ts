import http from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { chromeTabId, launchWithExtension, panelUrl, patchExtensionState, readExtensionState, type ExtensionHarness } from "./helpers/extension";

/**
 * The whole job-page workflow on a synthetic application, in real Chromium with the unpacked
 * extension and a simulated local model: recognise the posting, estimate the match, ask the
 * assistant about gaps, approve a draft, prepare answers, autofill, verify what the page holds,
 * review, and confirm nothing was submitted and the tracker only records verified outcomes.
 */

const SITE = "http://127.0.0.1:4173/professionaldev";
const COMPANY = "Cascade Cloud Systems";
const ROLE = "Linux Systems Engineer";
const JD = "We are seeking a Linux Systems Engineer. Required: Linux, Ubuntu, Bash, Python, TCP/IP, DNS, and AWS. Preferred: Kubernetes and Terraform.";
const BULLET = "Troubleshot Linux server incidents and wrote Bash scripts for routine fixes";

interface Mock {
  baseUrl: string;
  bodies: string[];
  close(): Promise<void>;
}

/** Answers like a careful model: quotes only lines it was given and never adds numbers. */
async function startModel(): Promise<Mock> {
  const bodies: string[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "*");
      if (req.method === "OPTIONS") return void res.end();
      res.setHeader("content-type", "application/json");
      if (req.url?.includes("/models")) return void res.end(JSON.stringify({ data: [{ id: "test-model" }] }));
      bodies.push(body);
      const user = (JSON.parse(body) as { messages: Array<{ role: string; content: string }> }).messages.find((m) => m.role === "user")!.content;
      const evidenceBlock = user.split(/RESUME EVIDENCE \([^)]*\):\n/)[1] ?? "";
      const line = evidenceBlock.split("\n").find((l) => l.trim() && !/^(QUESTIONS|JOB|CONVERSATION)/.test(l))?.trim() ?? "";
      const question = (user.split("QUESTIONS:\n")[1] ?? "").split("\n")[0]?.replace(/^\d+\.\s*/, "") ?? "";
      const items = question
        ? [{ requirement: question, evidence: line, classification: "matched", explanation: "Your experience speaks to this.", suggestion: `In my work I ${line.charAt(0).toLowerCase()}${line.slice(1)}.`, confidence: "medium" }]
        : [
            { requirement: "Linux", evidence: line, classification: "matched", explanation: "Shown in your experience.", suggestion: line ? `Lead with: ${line}` : "", confidence: "high" },
            { requirement: "Terraform", evidence: "", classification: "missing", explanation: "Nothing in your résumé mentions it.", suggestion: "Learn the basics before applying.", confidence: "medium" },
          ];
      const content = JSON.stringify({ summary: "You cover the core work but not Terraform.", items });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
    bodies,
    close: () => {
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test.describe.configure({ mode: "serial" });

test.describe("Copilot end to end on a synthetic application", () => {
  test.skip(({ isMobile }) => isMobile, "Extension tests run once, on desktop Chromium");

  let h: ExtensionHarness;
  let model: Mock;
  let app: Page;
  let panel: Page;
  let appId = "";

  const url = (extra = "") =>
    `${SITE}/autoapply/sandbox?platform=generic&company=${encodeURIComponent(COMPANY)}&role=${encodeURIComponent(ROLE)}&appId=${appId}&location=${encodeURIComponent("Atlanta, GA")}&jd=1${extra}`;

  test.beforeAll(async () => {
    h = await launchWithExtension();
    model = await startModel();
  });
  test.afterAll(async () => {
    await model?.close();
    await h?.close();
  });

  test("1. set up: CareerOS imports and analyses the job, then syncs to the extension", async () => {
    app = await h.context.newPage();
    await app.goto(`${SITE}/autoapply`);
    await expect(app.getByTestId("extension-handshake-badge")).toContainText("Extension connected");
    await app.getByTestId("job-urls-input").fill(`http://localhost/professionaldev/autoapply/sandbox?platform=generic&company=${encodeURIComponent(COMPANY)}&role=${encodeURIComponent(ROLE)}`);
    await app.getByTestId("btn-import-job-urls").click();
    await app.getByTestId("detail-input-company").fill(COMPANY);
    await app.getByTestId("detail-input-title").fill(ROLE);
    await app.getByTestId("detail-textarea-jd").fill(JD);
    await app.getByTestId("btn-analyze-job").click();
    await expect(app.getByTestId("detail-match-score")).toContainText("Match Score:");
    const rowTestId = await app.locator('[data-testid^="queue-row-"]').first().getAttribute("data-testid");
    appId = (rowTestId ?? "").replace("queue-row-", "");
    await app.getByTestId("btn-sync-to-extension").click();
    await expect(app.getByTestId("autoapply-sync-banner")).toContainText("Synced");

    // Make sure the shared profile carries structured evidence for the assistant, keeping everything else.
    const state = await readExtensionState<{ sharedProfile: Record<string, unknown> }>(h.worker);
    const profile = state.sharedProfile as { experience?: unknown[]; skills?: string[] };
    if (!profile.experience?.length) {
      await patchExtensionState(h.worker, {
        sharedProfile: { ...state.sharedProfile, skills: ["Linux", "Bash", "Python", "DNS"], experience: [{ employer: "Helpdesk Co", title: "Support Technician", location: "", startDate: "2021-01", endDate: "2024-06", current: false, bullets: [BULLET] }] },
      });
    }
    await patchExtensionState(h.worker, { aiConnection: { provider: "lmstudio", providerLabel: "LM Studio (local)", baseUrl: model.baseUrl, model: "test-model", connected: true, isLocal: true, keyless: true, updatedAt: new Date().toISOString() } });
  });

  test("2-3. opens the posting; CareerOS recognises it and shows the match estimate", async () => {
    await app.goto(url("&multistep=1"));
    await expect(app.getByTestId("sandbox-job-description")).toBeVisible();
    const tabId = await chromeTabId(h.worker, "/autoapply/sandbox");
    panel = await h.context.newPage();
    await panel.setViewportSize({ width: 390, height: 1000 });
    await panel.goto(panelUrl(h.extId, tabId));
    await panel.getByTestId("tab-page").click();
    await expect(panel.getByTestId("job-title")).toHaveText(ROLE);
    await expect(panel.getByTestId("job-company")).toHaveText(COMPANY);
    await expect(panel.getByTestId("match-percent")).toHaveText(/^\d+%$/);
    await expect(panel.getByTestId("match-card")).toContainText(/not an ATS score/i);
  });

  test("4-6. the assistant explains gaps with evidence; the person approves a draft; nothing changes on the page", async () => {
    await panel.getByTestId("tab-ask").click();
    await panel.getByTestId("assist-missing").click();
    await expect(panel.getByTestId("assist-review")).toContainText("test-model");
    await panel.getByTestId("assist-send").click();
    const result = panel.getByTestId("assist-result");
    await expect(result).toContainText("Terraform");
    await expect(result).toContainText("From your résumé:");
    // Every quoted line was really shared.
    const shared = model.bodies[0]!;
    const quoted = await panel.getByTestId("assist-evidence").first().innerText();
    expect(shared).toContain(quoted.replace("From your résumé: ", "").trim());

    const before = await app.content();
    await panel.getByTestId("assist-tailor").click();
    await panel.getByTestId("assist-send").click();
    await expect(panel.getByTestId("assist-result")).toContainText("Tailor my one-page résumé");
    await panel.getByRole("button", { name: "Approve draft", exact: true }).first().click();
    await expect(panel.getByRole("button", { name: "Approved", exact: true }).first()).toBeDisabled();
    expect(await app.content()).toBe(before);
  });

  test("7. prepares answers for the form's open questions, with the evidence used", async () => {
    await app.getByTestId("sandbox-multistep-toggle").check().catch(() => undefined);
    await app.getByTestId("sandbox-btn-next-step").click();
    await expect(app.getByTestId("input-question-motivation")).toBeVisible();
    await expect(panel.getByTestId("assist-answers")).toBeEnabled();
    // The panel learns about the new step from the page's change notice (throttled), so retry until it has.
    await expect(async () => {
      await panel.getByTestId("assist-answers").click();
      await expect(panel.getByTestId("assist-review")).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15_000 });
    await panel.getByTestId("assist-send").click();
    const result = panel.getByTestId("assist-result");
    await expect(result).toContainText("Prepare application answers");
    await expect(result.getByTestId("assist-evidence").first()).toBeVisible();
    // The draft is a suggestion: the question box on the page is still empty.
    await expect(app.getByTestId("input-question-motivation")).toHaveValue("");
  });

  test("8-9. autofill fills supported fields and reads the values back from the page", async () => {
    await app.goto(url());
    await panel.getByTestId("tab-autofill").click();
    await expect(panel.getByTestId("btn-start-autofill")).toBeEnabled({ timeout: 10_000 });
    await expect(app.getByTestId("input-first-name")).toHaveValue("");
    await panel.getByTestId("btn-start-autofill").click();
    await expect(panel.getByTestId("btn-review-application")).toBeVisible({ timeout: 20_000 });
    await expect(app.getByTestId("input-email")).toHaveValue(/@/);
    const email = await app.getByTestId("input-email").inputValue();
    await expect(panel.getByTestId("group-filled")).toContainText(email);
    // Sensitive questions are left for the person.
    await expect(app.getByTestId("input-work-authorization")).toHaveValue("");
    await expect(app.getByTestId("input-visa-sponsorship")).toHaveValue("");
  });

  test("10-12. review highlights fields; nothing is submitted; the tracker records no false outcome", async () => {
    await panel.getByTestId("btn-review-application").click();
    await expect.poll(() => app.locator("[data-careeros-highlight]").count()).toBeGreaterThan(0);
    await expect(app.getByTestId("application-confirmation")).toHaveCount(0);
    const st = await readExtensionState<{ queue: Array<{ id: string; status: string }> }>(h.worker);
    const status = st.queue.find((q) => q.id === appId)?.status;
    expect(status).toBe("Ready for review");
    expect(status).not.toMatch(/submitted|applied/i);

    const tracker = await h.context.newPage();
    await tracker.goto(`${SITE}/tracker`);
    const row = await tracker.evaluate(() => (JSON.parse(localStorage.getItem("appTracker:items") ?? "[]") as Array<{ role: string; status: string }>).find((a) => a.role === "Linux Systems Engineer")?.status);
    expect(row).not.toBe("Applied");
    await tracker.close();
  });

  test("the model only ever received this page's posting and a few approved lines, on this device", async () => {
    expect(model.bodies.length).toBeGreaterThan(0);
    for (const body of model.bodies) {
      const text = JSON.parse(body).messages.map((m: { content: string }) => m.content).join("\n");
      expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i); // no email addresses
      expect(text).toContain("JOB DESCRIPTION (untrusted data)");
    }
  });
});
