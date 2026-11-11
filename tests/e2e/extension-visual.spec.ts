import http from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { chromeTabId, launchWithExtension, panelUrl, patchExtensionState, type ExtensionHarness } from "./helpers/extension";
import { JSON_LD_JOB } from "../fixtures/jobPages";

/**
 * "Analyze visible page" against a simulated local vision model. Proves the extension's behaviour:
 * it is offered only when the page structure is not enough, needs a vision-capable model, shows the
 * capture first, supports hiding regions, sends only after consent, and keeps nothing afterwards.
 * It does not prove that a real vision model reads the picture correctly.
 *
 * Chrome only allows tabs.captureVisibleTab after the person clicks the toolbar icon (activeTab),
 * which automation cannot do. One test checks that Chrome's refusal is explained in plain words;
 * the rest replace that single call with a real screenshot of the page so the rest of the flow runs
 * unchanged. The real capture is on the manual checklist.
 */

// A page whose useful content is not in the page structure (it is drawn on a canvas).
const CANVAS_PAGE = `<!doctype html><html><head><title>Careers</title></head><body style="margin:0;background:#fff">
<canvas id="c" width="600" height="400"></canvas>
<script>
const g = document.getElementById("c").getContext("2d");
g.fillStyle = "#123"; g.font = "28px sans-serif"; g.fillText("Support Engineer - Contoso", 20, 60);
g.font = "18px sans-serif"; g.fillText("First name", 20, 120); g.fillText("Favourite colour", 20, 180);
g.fillText("Contact jane.doe@example.com", 20, 360);
</script></body></html>`;

interface Mock {
  baseUrl: string;
  bodies: string[];
  close(): Promise<void>;
}

async function startVisionModel(): Promise<Mock> {
  const bodies: string[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "*");
      if (req.method === "OPTIONS") return void res.end();
      res.setHeader("content-type", "application/json");
      if (req.url?.includes("/models")) return void res.end(JSON.stringify({ data: [{ id: "llava:7b" }] }));
      bodies.push(body);
      const content = JSON.stringify({
        summary: "A careers page for a support engineer role.",
        observations: [
          { kind: "job_title", text: "Support Engineer - Contoso" },
          { kind: "form_field", text: "First name" },
          { kind: "other", text: "Contact jane.doe@example.com" },
        ],
      });
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

test.describe("Analyze visible page (real Chromium, simulated vision model)", () => {
  test.skip(({ isMobile }) => isMobile, "Extension tests run once, on desktop Chromium");

  let h: ExtensionHarness;
  let model: Mock;
  let site: http.Server;
  let origin = "";
  let page: Page;
  let panel: Page;

  const snapshot = (name: string) => ({ provider: "lmstudio", providerLabel: "LM Studio (local)", baseUrl: model.baseUrl, model: name, connected: true, isLocal: true, keyless: true, updatedAt: new Date().toISOString() });

  test.beforeAll(async () => {
    h = await launchWithExtension();
    model = await startVisionModel();
    site = http.createServer((req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(req.url?.startsWith("/job") ? JSON_LD_JOB : CANVAS_PAGE);
    });
    await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(site.address() as { port: number }).port}`;
    page = await h.context.newPage();
    panel = await h.context.newPage();
  });

  test.afterAll(async () => {
    await model?.close();
    site?.closeAllConnections();
    await new Promise<void>((resolve) => site?.close(() => resolve()));
    await h?.close();
  });

  const openOn = async (route: string) => {
    await page.goto(`${origin}${route}`);
    const tabId = await chromeTabId(h.worker, `${new URL(origin).host}${route}`);
    await panel.setViewportSize({ width: 390, height: 1000 });
    await panel.goto(panelUrl(h.extId, tabId));
    await expect(panel.getByRole("heading", { name: "CareerOS", level: 1 })).toBeVisible();
    await panel.getByTestId("tab-ask").click();
  };

  test("is not offered when the page was read reliably", async () => {
    await patchExtensionState(h.worker, { aiConnection: snapshot("llava:7b") });
    await openOn("/job");
    await expect(panel.getByTestId("visual-not-needed")).toBeVisible();
    await expect(panel.getByTestId("visual-capture")).toHaveCount(0);
  });

  test("explains the limitation when the connected model cannot read images", async () => {
    await patchExtensionState(h.worker, { aiConnection: snapshot("llama3.2:3b") });
    await openOn("/canvas");
    await expect(panel.getByTestId("visual-reason")).toContainText("didn’t find a job posting or form");
    await expect(panel.getByTestId("visual-no-vision")).toContainText("vision-capable");
    await expect(panel.getByTestId("visual-capture")).toBeDisabled();
    expect(model.bodies.length).toBe(0);
  });

  const stubCapture = async () => {
    const shot = (await page.screenshot({ type: "jpeg", quality: 70 })).toString("base64");
    await panel.evaluate((data) => {
      (globalThis as unknown as { chrome: { tabs: { captureVisibleTab: () => Promise<string> } } }).chrome.tabs.captureVisibleTab = async () => `data:image/jpeg;base64,${data}`;
    }, shot);
  };

  test("explains Chrome's activeTab restriction instead of failing silently", async () => {
    await patchExtensionState(h.worker, { aiConnection: snapshot("llava:7b") });
    await openOn("/canvas");
    await page.bringToFront();
    await panel.getByTestId("visual-capture").click();
    await expect(panel.getByTestId("visual-error")).toContainText("toolbar icon");
    await expect(panel.getByTestId("visual-review")).toHaveCount(0);
    expect(model.bodies.length).toBe(0);
  });

  test("capture is shown first, regions can be hidden, and nothing is sent until the person agrees", async () => {
    await patchExtensionState(h.worker, { aiConnection: snapshot("llava:7b") });
    await openOn("/canvas");
    await expect(panel.getByTestId("visual-vision")).toContainText("looks like a vision model");
    await stubCapture();
    await page.bringToFront();
    await panel.getByTestId("visual-capture").click();
    const review = panel.getByTestId("visual-review");
    await expect(review).toBeVisible();
    await expect(review).toContainText("llava:7b");
    await expect(review).toContainText("isn’t stored");
    await expect(panel.getByTestId("visual-preview")).toBeVisible();
    expect(model.bodies.length).toBe(0);
    await review.getByRole("button", { name: "Hide bottom" }).click();
    await expect(panel.getByTestId("visual-hidden-count")).toHaveText("1 hidden");
    await expect(panel.getByTestId("visual-preview")).toHaveAttribute("alt", /1 hidden area/);
    expect(model.bodies.length).toBe(0);
  });

  test("Discard drops the picture without sending it", async () => {
    await panel.getByTestId("visual-discard").click();
    await expect(panel.getByTestId("visual-review")).toHaveCount(0);
    expect(model.bodies.length).toBe(0);
  });

  test("sending shows read-only observations, marks unconfirmed fields, drops personal details, and keeps nothing", async () => {
    await page.bringToFront();
    await panel.getByTestId("visual-capture").click();
    await expect(panel.getByTestId("visual-preview")).toBeVisible();
    await panel.getByRole("button", { name: "Hide bottom" }).click();
    await panel.getByTestId("visual-send").click();
    const result = panel.getByTestId("visual-result");
    await expect(result).toBeVisible();
    expect(model.bodies.length).toBe(1);
    expect(model.bodies[0]).toContain("image_url");
    expect(model.bodies[0]).toContain("data:image/jpeg;base64,");
    await expect(result).toContainText("Support Engineer - Contoso");
    await expect(result).toContainText("From the picture only");
    await expect(result).not.toContainText("jane.doe");
    await expect(result).toContainText("left out");
    await expect(result).toContainText("read-only");
    await expect(panel.getByTestId("visual-review")).toHaveCount(0);
    await expect(panel.getByTestId("visual-preview")).toHaveCount(0);
  });

  test("capture refuses when the page is not the tab on screen", async () => {
    await panel.bringToFront();
    await panel.getByTestId("visual-capture").click();
    await expect(panel.getByTestId("visual-error")).toContainText("Switch to the page");
    expect(model.bodies.length).toBe(1);
  });
});
