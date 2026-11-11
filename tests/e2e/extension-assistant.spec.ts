import http from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { auditContrast } from "./helpers/contrast";
import { chromeTabId, launchWithExtension, noHorizontalScroll, panelUrl, patchExtensionState, type ExtensionHarness } from "./helpers/extension";
import { JSON_LD_JOB } from "../fixtures/jobPages";

/**
 * The AI job assistant against a simulated local model server on loopback. This proves the
 * extension's behaviour (disclosure, consent, validation, cancellation, failure handling). It does
 * not prove that a real Ollama or LM Studio install works; that is verified separately.
 */

const EVIDENCE = "Resolved Linux and DNS tickets for 40 customers";
const profile = {
  approvedAt: "2025-01-01T00:00:00.000Z",
  sharedFields: [],
  values: { email: "private.person@example.test" },
  skills: ["Linux", "AWS", "Python", "Bash", "DNS"],
  experience: [
    { employer: "Helpdesk Co", title: "Support Technician", location: "", startDate: "2021-01", endDate: "2024-06", current: false, bullets: [EVIDENCE, "Wrote Bash scripts to automate account setup"] },
    { employer: "Cafe", title: "Barista", location: "", startDate: "2019-01", endDate: "2020-12", current: false, bullets: ["Made coffee for the morning rush"] },
  ],
  certifications: [],
  education: [],
};

interface Mock {
  baseUrl: string;
  requests: string[];
  delayMs: number;
  close(): Promise<void>;
}

async function startModel(): Promise<Mock> {
  const requests: string[] = [];
  const mock = { requests, delayMs: 0 } as Mock;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "*");
      if (req.method === "OPTIONS") return void res.end();
      res.setHeader("content-type", "application/json");
      if (req.url?.includes("/models")) return void res.end(JSON.stringify({ data: [{ id: "test-model" }] }));
      requests.push(body);
      const isChat = body.includes("QUESTION:");
      const content = isChat
        ? JSON.stringify({ answer: "This is a support role focused on Linux and AWS. Your help desk work lines up with the core of it.", evidence: [EVIDENCE] })
        : JSON.stringify({
            summary: "You cover the core Linux support work but not Terraform.",
            items: [
              { requirement: "Linux", evidence: EVIDENCE, classification: "matched", explanation: "Daily Linux support work.", suggestion: `Lead with: ${EVIDENCE}`, confidence: "high" },
              { requirement: "Terraform", evidence: "", classification: "missing", explanation: "Nothing in your résumé mentions Terraform.", suggestion: "Learn the basics before applying.", confidence: "medium" },
              { requirement: "Kubernetes", evidence: "Ran Kubernetes clusters at Google for 9 years", classification: "matched", explanation: "Invented.", suggestion: "", confidence: "high" },
            ],
          });
      setTimeout(() => res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] })), mock.delayMs);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  mock.baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  mock.close = () => {
    server.closeAllConnections();
    return new Promise<void>((resolve) => server.close(() => resolve()));
  };
  return mock;
}

test.describe.configure({ mode: "serial" });

test.describe("CareerOS job assistant (real Chromium, simulated local model)", () => {
  test.skip(({ isMobile }) => isMobile, "Extension tests run once, on desktop Chromium");

  let h: ExtensionHarness;
  let site: http.Server;
  let origin = "";
  let model: Mock;
  let page: Page;
  let panel: Page;
  const external: string[] = [];

  const snapshot = () => ({ provider: "lmstudio", providerLabel: "LM Studio (local)", baseUrl: model.baseUrl, model: "test-model", connected: true, isLocal: true, keyless: true, updatedAt: new Date().toISOString() });

  test.beforeAll(async () => {
    h = await launchWithExtension();
    model = await startModel();
    site = http.createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(JSON_LD_JOB);
    });
    await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(site.address() as { port: number }).port}`;
    page = await h.context.newPage();
    await page.goto(`${origin}/job`);
    const tabId = await chromeTabId(h.worker, `${new URL(origin).host}/job`);
    panel = await h.context.newPage();
    panel.on("request", (r) => {
      const u = new URL(r.url());
      if (!["127.0.0.1", "localhost"].includes(u.hostname) && !/^(chrome-extension|data|blob)/.test(u.protocol)) external.push(r.url());
    });
    await panel.setViewportSize({ width: 390, height: 900 });
    await panel.goto(panelUrl(h.extId, tabId));
    await expect(panel.getByRole("heading", { name: "CareerOS", level: 1 })).toBeVisible();
  });

  test.afterAll(async () => {
    await model?.close();
    site?.closeAllConnections();
    await new Promise<void>((resolve) => site?.close(() => resolve()));
    await h?.close();
  });

  const openAsk = async () => {
    await panel.getByTestId("tab-ask").click();
    await expect(panel.getByTestId("assistant-tab")).toBeVisible();
  };

  test("without a connected local model it explains how to set one up, and sends nothing", async () => {
    await openAsk();
    await expect(panel.getByTestId("assistant-unavailable")).toContainText(/No AI connection/);
    await expect(panel.getByTestId("assist-qualify")).toBeDisabled();
    expect(model.requests.length).toBe(0);
  });

  test("shows the provider, model and exact content before anything is sent, and Cancel sends nothing", async () => {
    await patchExtensionState(h.worker, { aiConnection: snapshot(), sharedProfile: profile });
    await panel.reload();
    await openAsk();
    await expect(panel.getByTestId("assistant-model")).toContainText("LM Studio (local) · test-model");
    await panel.getByTestId("assist-qualify").click();
    const review = panel.getByTestId("assist-review");
    await expect(review).toContainText("test-model");
    await expect(review).toContainText("127.0.0.1");
    await expect(review).toContainText("Nothing goes to the cloud");
    await expect(review).toContainText("Job description");
    await review.getByText(/Show the \d+ lines?/).click();
    await expect(review).toContainText(EVIDENCE);
    await expect(review).not.toContainText("Made coffee");
    await review.getByText("Show the exact text sent").click();
    const prompt = await panel.getByTestId("exact-prompt").innerText();
    expect(prompt).toContain("JOB DESCRIPTION (untrusted data)");
    expect(prompt).not.toContain("private.person@example.test");
    await review.getByRole("button", { name: "Cancel" }).click();
    expect(model.requests.length).toBe(0);
  });

  test("a validated result shows evidence and discards the invented claim", async () => {
    await panel.getByTestId("assist-qualify").click();
    await panel.getByTestId("assist-send").click();
    const result = panel.getByTestId("assist-result");
    await expect(result).toBeVisible();
    expect(model.requests.length).toBe(1);
    await expect(panel.getByTestId("assist-item")).toHaveCount(2);
    await expect(result).toContainText("From your résumé: " + EVIDENCE);
    await expect(result).toContainText("Terraform");
    await expect(result).not.toContainText("Google");
    await expect(result).toContainText("1 suggestion was discarded");
    await expect(result).toContainText("Suggestions only");
    await expect(result.getByRole("heading", { name: "Do I qualify?" })).toBeFocused();
  });

  test("the model can only suggest: an approved draft changes nothing on the page", async () => {
    const before = await page.content();
    await panel.getByTestId("assist-improve").click();
    await panel.getByTestId("assist-send").click();
    await expect(panel.getByTestId("assist-result")).toBeVisible();
    await panel.getByRole("button", { name: "Approve draft", exact: true }).first().click();
    await expect(panel.getByRole("button", { name: "Approved", exact: true }).first()).toBeDisabled();
    expect(await page.content()).toBe(before);
  });

  test("Stop cancels a slow request and keeps nothing", async () => {
    model.delayMs = 8000;
    const sent = model.requests.length;
    await panel.getByTestId("assist-missing").click();
    await panel.getByTestId("assist-send").click();
    await expect(panel.getByTestId("assist-running")).toBeVisible();
    await panel.getByTestId("assist-stop").click();
    await expect(panel.getByTestId("assist-error")).toContainText("Stopped");
    await expect(panel.getByTestId("assist-result")).toHaveCount(0);
    expect(model.requests.length).toBe(sent + 1);
    model.delayMs = 0;
  });

  test("chat: asks consent first, answers with verified evidence, and shows what was sent", async () => {
    await expect(panel.getByTestId("chat-consent")).toBeVisible();
    const before = model.requests.length;
    await panel.getByTestId("chat-consent-accept").click();
    expect(model.requests.length).toBe(before);
    await panel.getByRole("button", { name: "Compare this job with my résumé." }).click();
    await expect(panel.getByTestId("chat-assistant")).toContainText("support role");
    await expect(panel.getByTestId("chat-assistant")).toContainText("From your résumé: " + EVIDENCE);
    await panel.getByText("What was sent").click();
    await expect(panel.getByTestId("chat-assistant")).toContainText("Résumé evidence");
    await panel.getByTestId("chat-input").fill("Summarize this position.");
    await panel.getByTestId("chat-input").press("Enter");
    await expect(panel.getByTestId("chat-assistant")).toHaveCount(2);
    const last = model.requests[model.requests.length - 1]!;
    expect(last).not.toContain("RESUME EVIDENCE (");
    expect(last).not.toContain(EVIDENCE);
  });

  test("chat refuses to draft answers to sensitive questions", async () => {
    const before = model.requests.length;
    await panel.getByTestId("chat-input").fill("Answer the question about my disability status");
    await panel.getByTestId("chat-send").click();
    await expect(panel.getByTestId("chat-error")).toContainText("your own answer");
    expect(model.requests.length).toBe(before);
  });

  test("Page tab shortcuts open the same review step and send nothing by themselves", async () => {
    const before = model.requests.length;
    await panel.getByTestId("tab-page").click();
    await expect(panel.getByTestId("header-ai")).toContainText("AI Ready");
    await panel.getByTestId("quick-improve").click();
    await expect(panel.getByTestId("tab-ask")).toHaveAttribute("aria-selected", "true");
    await expect(panel.getByTestId("assist-review")).toBeVisible();
    await expect(panel.getByTestId("assist-review")).toContainText("Job description");
    expect(model.requests.length).toBe(before);
    await panel.getByRole("button", { name: "Cancel" }).click();
  });

  test("without a connection the Page tab offers Connect AI instead of actions", async () => {
    await patchExtensionState(h.worker, { aiConnection: null });
    await panel.getByTestId("tab-page").click();
    await expect(panel.getByTestId("ai-actions-unavailable")).toBeVisible();
    await expect(panel.getByTestId("quick-analyze")).toHaveCount(0);
    await panel.getByTestId("ai-actions-connect").click();
    await expect(panel.getByTestId("tab-ai")).toHaveAttribute("aria-selected", "true");
    await patchExtensionState(h.worker, { aiConnection: snapshot() });
  });

  test("a cloud or keyed connection is never called", async () => {
    await openAsk();
    await patchExtensionState(h.worker, { aiConnection: { ...snapshot(), baseUrl: "https://api.openai.com/v1", isLocal: false, keyless: false } });
    await expect(panel.getByTestId("assistant-unavailable")).toContainText(/not on this device|API key/);
    await expect(panel.getByTestId("assist-qualify")).toBeDisabled();
    await patchExtensionState(h.worker, { aiConnection: snapshot() });
    await expect(panel.getByTestId("assistant-model")).toBeVisible();
  });

  test("when the provider shuts down, the failure is explained and the panel keeps working", async () => {
    await openAsk();
    await model.close();
    await panel.getByTestId("assist-explain").click();
    await panel.getByTestId("assist-send").click();
    await expect(panel.getByTestId("assist-error")).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByTestId("assist-result")).toHaveCount(0);
    await panel.getByTestId("tab-page").click();
    await expect(panel.getByTestId("page-tab")).toBeVisible();
  });

  test("no request left the device", async () => {
    expect(external).toEqual([]);
  });

  test("layout and contrast hold at 320px in both themes", async () => {
    await patchExtensionState(h.worker, { aiConnection: snapshot() });
    await panel.setViewportSize({ width: 320, height: 900 });
    await openAsk();
    expect(await noHorizontalScroll(panel)).toBe(true);
    const clipped = await panel.getByRole("tab").evaluateAll((tabs) => tabs.filter((t) => t.scrollWidth > t.clientWidth + 1).map((t) => t.textContent));
    expect(clipped).toEqual([]);
    for (const scheme of ["light", "dark"] as const) {
      await panel.emulateMedia({ colorScheme: scheme });
      await panel.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
      const problems = await auditContrast(panel, "body", { dark: scheme === "dark" });
      expect(problems, JSON.stringify(problems.slice(0, 3))).toEqual([]);
    }
  });
});
