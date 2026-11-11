import { expect, test } from "@playwright/test";
import { auditContrast, setTheme, type ContrastProblem } from "./helpers/contrast";
import { CLASSIC_RESUME } from "../fixtures/resumes";
import { IT_SUPPORT_JD } from "../fixtures/jobs";

/**
 * Measured contrast (WCAG 2.2 AA) and "no bright surface left behind in dark mode" for the main
 * CareerOS screens, in both themes. The résumé page itself is always a white printable document
 * and the interview stage is always dark, so those two are exempt from the bright-surface check.
 */
const ROUTES = ["dashboard", "matches", "jobs", "tracker", "documents", "interviews", "resume", "settings", "analytics", "coach", "academy", "applications"];
const allowBright = ".rd-doc, .rd-page, #resume-print-root, .iv-stage";
const report = (problems: ContrastProblem[]) => problems.map((p) => `${p.kind} ${p.ratio || ""} ${p.selector} "${p.text.replace(/\s+/g, " ")}" ${p.color} on ${p.background}`).join("\n");

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme audit`, () => {
    test.beforeEach(async ({ page, isMobile }) => {
      test.skip(isMobile, "contrast is viewport independent; run once on desktop");
      await setTheme(page, theme);
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    const audit = async (page: import("@playwright/test").Page) => {
      const problems = await auditContrast(page, "body", { dark: theme === "dark", allowBright });
      expect(problems, report(problems)).toEqual([]);
    };

    for (const route of ROUTES) {
      test(`/${route}`, async ({ page }) => {
        await page.goto(`./${route}`);
        await page.waitForTimeout(600);
        await audit(page);
      });
    }

    test("résumé studio with a résumé, analyzed requirements, and match results", async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto("./resume");
      await page.locator('input[type="file"]').first().setInputFiles({ name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from(CLASSIC_RESUME) });
      await expect(page.getByRole("heading", { level: 1, name: "Jordan Rivera" }).first()).toBeVisible();
      await audit(page);
      await page.getByRole("tab", { name: /^Job match/ }).first().click();
      await page.getByRole("textbox", { name: "Paste the job description" }).fill(IT_SUPPORT_JD);
      await page.getByRole("button", { name: /Analyze requirements/ }).click();
      await expect(page.locator(".rs-req").first()).toBeVisible();
      await audit(page);
      await page.getByRole("tab", { name: /Match & suggestions/ }).click();
      await expect(page.locator(".rs-score-value").first()).toBeVisible();
      await audit(page);
    });

    test("interview studio setup, session room, and report", async ({ page }) => {
      await page.goto("./interviews");
      await expect(page.getByRole("button", { name: /Start practice session/ })).toBeVisible();
      await audit(page);
      await page.getByRole("button", { name: /Start practice session/ }).click();
      await expect(page.getByRole("button", { name: "Start answer" })).toBeVisible();
      await audit(page);
      await page.getByRole("button", { name: "Start answer" }).click();
      await page.getByRole("textbox", { name: "Your answer" }).fill("When I was working at the help desk, my goal was to restore printing for 300 students. I rolled back a driver update. As a result, printing was restored in 40 minutes.");
      await page.getByRole("button", { name: "Stop answer" }).click();
      await page.getByRole("button", { name: "End session" }).click();
      await expect(page.getByText("Answer review").first()).toBeVisible();
      await audit(page);
    });
  });
}
