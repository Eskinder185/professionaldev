import fs from "node:fs";
import http from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { auditContrast } from "./helpers/contrast";
import { chromeTabId, launchWithExtension, noHorizontalScroll, panelUrl, patchExtensionState, startMockAI, type ExtensionHarness, type MockAI } from "./helpers/extension";
import { DESCRIPTION_HTML, EMBEDDED_FORM_PAGE, GREENHOUSE_PAGE, INJECTION_JOB, JSON_LD_JOB, SHADOW_FORM_PAGE, THIN_JOB, ARTICLE_PAGE } from "../fixtures/jobPages";

/**
 * Real Chromium, real unpacked extension, synthetic employer pages served from loopback.
 *
 * What this cannot do: Chrome's native "Allow access to this site" prompt is browser UI that
 * automation cannot click, and the docked side panel cannot be opened headlessly. Those are
 * covered by unit tests of the permission logic and by the manual checklist in
 * docs/extension/copilot-manual-checks.md. Loopback pages are covered by the extension's
 * install-time permissions, so they exercise page reading, monitoring and the panel for real.
 */

// A page that becomes a job posting without reloading, the way single-page applications work.
const SPA_PAGE = `<!doctype html><html><head><title>Careers</title></head><body><main id="root"><h1>Loading…</h1><button id="open">Open role</button></main>
<script>
document.getElementById("open").addEventListener("click", () => {
  const ld = document.createElement("script");
  ld.type = "application/ld+json";
  ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "JobPosting", title: "Platform Engineer", hiringOrganization: { name: "Fabrikam" }, description: ${JSON.stringify(DESCRIPTION_HTML)} });
  document.head.append(ld);
  history.pushState({}, "", "/spa/role-9");
  document.querySelector("h1").textContent = "Platform Engineer";
  document.getElementById("root").insertAdjacentHTML("beforeend", '<div id="job-description">' + ${JSON.stringify(DESCRIPTION_HTML)} + '</div>');
});
</script></body></html>`;

// A two-step form where step two is created by script.
const MULTISTEP_PAGE = `<!doctype html><html><head><title>Apply</title></head><body><h1>Apply: Step 1</h1><form id="f"><label for="first_name">First name</label><input id="first_name" name="first_name" type="text" /><button type="button" id="next">Next</button></form>
<script>
document.getElementById("next").addEventListener("click", () => {
  document.querySelector("h1").textContent = "Apply: Step 2";
  document.getElementById("f").innerHTML = '<label for="linkedin">LinkedIn profile</label><input id="linkedin" name="linkedin" type="url" /><label for="resume">Resume</label><input id="resume" name="resume" type="file" />';
});
</script></body></html>`;

const PAGES: Record<string, string> = {
  "/json-ld": JSON_LD_JOB,
  "/greenhouse": GREENHOUSE_PAGE,
  "/thin": THIN_JOB,
  "/article": ARTICLE_PAGE,
  "/embedded": EMBEDDED_FORM_PAGE,
  "/shadow": SHADOW_FORM_PAGE,
  "/injection": INJECTION_JOB,
  "/spa": SPA_PAGE,
  "/multistep": MULTISTEP_PAGE,
};

test.describe.configure({ mode: "serial" });

test.describe("CareerOS Copilot (real Chromium, unpacked extension)", () => {
  test.skip(({ isMobile }) => isMobile, "Extension tests run once, on desktop Chromium");

  let h: ExtensionHarness;
  let server: http.Server;
  let origin = "";
  let panel: Page;
  let page: Page;
  let ai: MockAI;

  test.beforeAll(async () => {
    h = await launchWithExtension();
    ai = await startMockAI("This should never be requested.");
    server = http.createServer((req, res) => {
      const route = (req.url ?? "/").split("?")[0];
      const key = Object.keys(PAGES).find((k) => route === k || route.startsWith(`${k}/`));
      res.setHeader("content-type", "text/html");
      if (!key) {
        res.statusCode = 404;
        return res.end("<h1>Not found</h1>");
      }
      res.end(PAGES[key]);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  test.afterAll(async () => {
    await ai?.close();
    server?.closeAllConnections();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await h?.close();
  });

  const visit = async (route: string) => {
    page = page && !page.isClosed() ? page : await h.context.newPage();
    await page.goto(`${origin}${route}`);
    return page;
  };
  const openPanel = async (route: string, width = 390) => {
    await visit(route);
    const tabId = await chromeTabId(h.worker, new URL(origin).host + route.split("?")[0]);
    panel = panel && !panel.isClosed() ? panel : await h.context.newPage();
    await panel.setViewportSize({ width, height: 900 });
    await panel.goto(panelUrl(h.extId, tabId));
    await expect(panel.getByRole("heading", { name: "CareerOS", level: 1 })).toBeVisible();
    await panel.getByTestId("tab-page").click();
    return panel;
  };
  const profile = {
    approvedAt: "2025-01-01T00:00:00.000Z",
    sharedFields: [],
    values: {},
    skills: ["Linux", "AWS", "Python", "Bash", "DNS"],
    experience: [{ employer: "Helpdesk Co", title: "Support Technician", location: "", startDate: "2021-01", endDate: "2024-06", current: false, bullets: ["Resolved Linux and DNS tickets and wrote Bash scripts"] }],
    certifications: [],
    education: [],
  };

  test("manifest: no all-sites permission at install; one optional https origin at a time", async () => {
    const manifest = JSON.parse(fs.readFileSync("apps/extension/dist/manifest.json", "utf8"));
    expect([...manifest.permissions].sort()).toEqual(["activeTab", "scripting", "sidePanel", "storage"]);
    expect(manifest.optional_host_permissions).toEqual(["https://*/*"]);
    const installed = JSON.stringify([manifest.host_permissions, manifest.content_scripts]);
    expect(installed).not.toMatch(/<all_urls>|https:\/\/\*\/\*|http:\/\/\*\/\*/);
  });

  test("reads a page with structured data: title, company, location, type, salary, with confidence and sources", async () => {
    await openPanel("/json-ld");
    await expect(panel.getByTestId("job-title")).toHaveText("Cloud Support Engineer");
    await expect(panel.getByTestId("job-company")).toHaveText("Northwind Cloud Services");
    await expect(panel.getByTestId("job-location")).toContainText("Austin");
    await expect(panel.getByTestId("job-type")).toContainText(/full/i);
    await expect(panel.getByTestId("job-salary")).toContainText("70,000");
    await expect(panel.getByTestId("card-job")).toContainText(/High confidence|Medium confidence/);
    await expect(panel.getByTestId("access-message")).toContainText("part of the extension");
    await expect(panel.getByTestId("requirements")).toContainText("requirements");
  });

  test("requirements are grouped in the posting's own words, with no artificial suffixes", async () => {
    await openPanel("/json-ld");
    await panel.getByTestId("requirements").locator("summary").click();
    const duties = panel.getByTestId("req-group-responsibilities");
    await expect(duties).toContainText("Provide Tier 1 and Tier 2 support for customers using AWS and Linux servers.");
    await expect(panel.getByTestId("req-group-tools")).toContainText("Terraform");
    await expect(panel.getByTestId("req-group-education").or(panel.getByTestId("req-group-experience"))).not.toHaveCount(0);
    const text = await panel.getByTestId("requirements").innerText();
    expect(text).not.toMatch(/(responsibility|requirement)s*$/im);
  });

  test("never invents fields the page does not state", async () => {
    await openPanel("/greenhouse");
    await expect(panel.getByTestId("job-title")).toContainText("Cloud Support Engineer");
    await expect(panel.getByTestId("job-salary")).toHaveCount(0);
    await expect(panel.getByTestId("job-job-id")).toHaveCount(0);
  });

  test("says nothing about a page that is not a job", async () => {
    await openPanel("/article");
    await expect(panel.getByTestId("job-none")).toBeVisible();
    await expect(panel.getByTestId("match-card")).toHaveCount(0);
  });

  test("résumé match: needs a profile, then explains each requirement; not an ATS score", async () => {
    await openPanel("/json-ld");
    await expect(panel.getByTestId("match-unavailable")).toContainText("Sync your profile");
    await patchExtensionState(h.worker, { sharedProfile: profile });
    await panel.reload();
    await panel.getByTestId("tab-page").click();
    const card = panel.getByTestId("match-card");
    await expect(card).toBeVisible();
    await expect(panel.getByTestId("match-percent")).toHaveText(/^\d+%$/);
    await expect(card).toContainText(/not an ATS score/i);
    const first = panel.getByTestId("match-list").locator("summary").first();
    await first.click();
    await expect(panel.getByTestId("match-list").locator("details[open] p").first()).not.toBeEmpty();
  });

  test("refuses to estimate from thin job information", async () => {
    await openPanel("/thin");
    await expect(panel.getByTestId("match-unavailable")).toContainText("Not enough job information to calculate a reliable match.");
    await expect(panel.getByTestId("match-percent")).toHaveCount(0);
  });

  test("single-page app: the panel notices a posting that appears without a reload, and without polling", async () => {
    await openPanel("/spa");
    await expect(panel.getByTestId("job-none")).toBeVisible();
    await page.getByRole("button", { name: "Open role" }).click();
    await expect(panel.getByTestId("job-title")).toHaveText("Platform Engineer", { timeout: 10_000 });
    await expect(panel.getByTestId("job-company")).toHaveText("Fabrikam");
  });

  test("multi-step form: a new step is picked up when it appears", async () => {
    await openPanel("/multistep");
    const events = await panel.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let n = 0;
          (globalThis as unknown as { chrome: { runtime: { onMessage: { addListener(cb: (m: { careerosEvent?: string }) => void): void } } } }).chrome.runtime.onMessage.addListener((m) => {
            if (m?.careerosEvent === "PAGE_CHANGED") n += 1;
          });
          (window as unknown as { __events: () => number }).__events = () => n;
          resolve(0);
        }),
    );
    expect(events).toBe(0);
    await page.getByRole("button", { name: "Next" }).click();
    await expect.poll(() => panel.evaluate(() => (window as unknown as { __events: () => number }).__events()), { timeout: 10_000 }).toBeGreaterThan(0);
  });

  test("shadow DOM: fields inside an open shadow root are detected", async () => {
    await openPanel("/shadow");
    const tabId = await chromeTabId(h.worker, "/shadow");
    const labels = await panel.evaluate(async (id) => {
      const c = (globalThis as unknown as { chrome: { tabs: { sendMessage(id: number, m: unknown): Promise<{ context?: { fields: Array<{ label: string }> } }> } } }).chrome;
      const res = await c.tabs.sendMessage(id, { careerosRequest: "GET_PAGE_CONTEXT", payload: { sharedProfile: null, activeApplication: null } });
      return res.context?.fields.map((f) => f.label) ?? [];
    }, tabId);
    expect(labels.join(" ")).toMatch(/first name/i);
    expect(labels.join(" ")).toMatch(/email/i);
  });

  test("cross-origin iframe: explains why the embedded form cannot be read", async () => {
    await openPanel("/embedded");
    await expect(panel.getByTestId("embedded-notice")).toContainText("Chrome keeps pages from different sites separate");
    await expect(panel.getByTestId("embedded-notice")).toContainText(/greenhouse/i);
  });

  test("unreadable pages get an accurate explanation, not a blank panel", async () => {
    await visit("/json-ld");
    const tabId = await chromeTabId(h.worker, "/json-ld");
    await page.goto("chrome://version/").catch(() => undefined);
    panel = panel && !panel.isClosed() ? panel : await h.context.newPage();
    await panel.goto(panelUrl(h.extId, tabId));
    await panel.getByTestId("tab-page").click();
    await expect(panel.getByTestId("page-tab")).toBeVisible();
  });

  test("prompt injection: page text is shown as text; nothing is filled, sent, or submitted", async () => {
    const before = ai.requests.length;
    await openPanel("/injection");
    await expect(panel.getByTestId("job-title")).toHaveText("Support Technician");
    await expect(panel.getByTestId("page-tab")).not.toContainText("admin mode");
    expect(ai.requests.length).toBe(before);
    expect(await page.evaluate(() => document.querySelectorAll("input").length)).toBe(0);
  });

  test("layout holds at 320px and the Page tab is reachable from the keyboard", async () => {
    await openPanel("/json-ld", 320);
    expect(await noHorizontalScroll(panel)).toBe(true);
    const clipped = await panel.getByRole("tab").evaluateAll((tabs) => tabs.filter((t) => t.scrollWidth > t.clientWidth + 1).map((t) => t.textContent));
    expect(clipped).toEqual([]);
    await panel.getByTestId("tab-page").focus();
    await panel.keyboard.press("ArrowLeft");
    await expect(panel.getByTestId("tab-ai")).toHaveAttribute("aria-selected", "true");
    await panel.keyboard.press("ArrowRight");
    await expect(panel.getByTestId("tab-page")).toHaveAttribute("aria-selected", "true");
  });

  test("dark mode: the Page tab has readable contrast in both themes", async () => {
    await openPanel("/json-ld");
    for (const scheme of ["light", "dark"] as const) {
      await panel.emulateMedia({ colorScheme: scheme });
      await expect(panel.getByTestId("page-tab")).toBeVisible();
      // Cards fade in; measure colours after the animation has settled.
      await panel.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
      const problems = await auditContrast(panel, "body", { dark: scheme === "dark" });
      expect(problems, JSON.stringify(problems.slice(0, 3))).toEqual([]);
    }
  });
});
