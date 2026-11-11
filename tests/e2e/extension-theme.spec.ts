import { expect, test, type Page } from "@playwright/test";
import { auditContrast, type ContrastProblem } from "./helpers/contrast";
import { launchWithExtension, panelUrl, type ExtensionHarness } from "./helpers/extension";

const SITE = "http://127.0.0.1:4173/professionaldev";
const report = (problems: ContrastProblem[]) => problems.map((p) => `${p.kind} ${p.ratio || ""} ${p.selector} "${p.text.replace(/\s+/g, " ")}" ${p.color} on ${p.background}`).join("\n");

/**
 * The real unpacked extension in real Chromium: its pages follow the appearance chosen on the
 * CareerOS website, and each page is readable in both themes.
 */
test.describe.configure({ mode: "serial" });

test.describe("extension appearance (real Chromium)", () => {
  let h: ExtensionHarness;
  let site: Page;

  test.beforeAll(async () => {
    h = await launchWithExtension();
    site = await h.context.newPage();
  });
  test.afterAll(async () => {
    await h?.close();
  });
  test.beforeEach(async ({ isMobile }, info) => {
    test.skip(isMobile || info.project.name !== "desktop-chromium", "extension tests run once, on desktop Chromium");
  });

  const pages = (extId: string) => [
    { name: "side panel", url: panelUrl(extId), width: 400 },
    { name: "popup", url: `chrome-extension://${extId}/popup/index.html`, width: 340 },
    { name: "options", url: `chrome-extension://${extId}/options/index.html`, width: 900 },
  ];

  for (const theme of ["dark", "light"] as const) {
    test(`choosing ${theme} on the website themes every extension page, with readable contrast`, async () => {
      await site.goto(`${SITE}/settings`);
      await site.getByRole("radiogroup", { name: "Appearance" }).getByRole("radio", { name: theme === "dark" ? "Dark" : "Light" }).click();
      await expect(site.locator("html")).toHaveClass(new RegExp(theme));
      // The installed extension's content script copies the choice into extension storage.
      await expect
        .poll(async () =>
          h.worker.evaluate(async () => {
            const c = (globalThis as unknown as { chrome: { storage: { local: { get: (k: string) => Promise<Record<string, unknown>> } } } }).chrome;
            return (await c.storage.local.get("careeros:theme"))["careeros:theme"];
          }),
        )
        .toBe(theme);

      for (const target of pages(h.extId)) {
        const page = await h.context.newPage();
        // Emulate the opposite system setting to prove the explicit choice wins.
        await page.emulateMedia({ colorScheme: theme === "dark" ? "light" : "dark" });
        await page.setViewportSize({ width: target.width, height: 800 });
        await page.goto(target.url);
        await expect(page.locator("html"), target.name).toHaveAttribute("data-theme", theme);
        await page.waitForTimeout(500);
        const problems = await auditContrast(page, "body", { dark: theme === "dark" });
        expect(problems, `${target.name} (${theme})\n${report(problems)}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${target.name} horizontal overflow`).toBeLessThanOrEqual(0);
        await page.close();
      }
    });
  }

  test("System follows the device, and the options page can change appearance", async () => {
    const options = await h.context.newPage();
    await options.goto(`chrome-extension://${h.extId}/options/index.html`);
    await options.getByTestId("opt-theme").selectOption("system");
    await expect(options.locator("html")).not.toHaveAttribute("data-theme", /.+/);
    await options.emulateMedia({ colorScheme: "dark" });
    const darkBg = await options.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await options.emulateMedia({ colorScheme: "light" });
    const lightBg = await options.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(darkBg).not.toBe(lightBg);
    await options.getByTestId("opt-theme").selectOption("dark");
    await expect(options.locator("html")).toHaveAttribute("data-theme", "dark");
    // Other extension pages pick the change up without a reload of the extension.
    const panel = await h.context.newPage();
    await panel.goto(panelUrl(h.extId));
    await expect(panel.locator("html")).toHaveAttribute("data-theme", "dark");
    await options.close();
    await panel.close();
  });
});
