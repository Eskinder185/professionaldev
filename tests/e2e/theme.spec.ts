import { expect, test, type Page } from "@playwright/test";
import { auditContrast, setTheme, type ContrastProblem } from "./helpers/contrast";

const report = (problems: ContrastProblem[]) => problems.map((p) => `${p.kind} ${p.ratio || ""} ${p.selector} "${p.text}" ${p.color} on ${p.background}`).join("\n");

async function loadAutoApplyQueue(page: Page) {
  await page.goto("./autoapply");
  await page.getByTestId("btn-load-sample-urls").click();
  await page.getByRole("button", { name: "Import Links to Queue" }).click();
  await expect(page.getByTestId("metric-total-queued")).not.toHaveText("0");
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await setTheme(page, theme);
    });

    test("AutoApply with a loaded queue has readable text and no stray surfaces", async ({ page, isMobile }) => {
      test.skip(isMobile, "contrast is viewport independent");
      await page.setViewportSize({ width: 1440, height: 1000 });
      await loadAutoApplyQueue(page);
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      const problems = await auditContrast(page, "main", { dark: theme === "dark" });
      expect(problems, report(problems)).toEqual([]);
    });

    test("AutoApply practice sandbox has readable text and no stray surfaces", async ({ page, isMobile }) => {
      test.skip(isMobile, "contrast is viewport independent");
      await page.goto("./autoapply/sandbox");
      await expect(page.getByTestId("synthetic-application-page")).toBeVisible();
      const problems = await auditContrast(page, "main", { dark: theme === "dark" });
      expect(problems, report(problems)).toEqual([]);
    });
  });
}

test("appearance: Light, Dark, and System are separate, persistent choices", async ({ page, isMobile }) => {
  test.skip(isMobile, "settings layout is the same");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./settings");
  const group = page.getByRole("radiogroup", { name: "Appearance" });
  // A new visitor follows the device.
  await expect(group.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveClass(/dark/);
  // System reacts to the operating system without a reload.
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/light/);
  // An explicit choice wins over the device and survives a reload.
  await group.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("radiogroup", { name: "Appearance" }).getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "Appearance" }).getByRole("radio", { name: "Light" }).click();
  await page.goto("./autoapply");
  await expect(page.locator("html")).toHaveClass(/light/);
  // Back to System: follows the device again.
  await page.goto("./settings");
  await page.getByRole("radiogroup", { name: "Appearance" }).getByRole("radio", { name: "System" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("the stored theme is applied before first paint (no flash)", async ({ page, isMobile }) => {
  test.skip(isMobile);
  await page.emulateMedia({ colorScheme: "dark" });
  await setTheme(page, "light");
  // Block the app bundle: the class must already be right from the inline script alone.
  await page.route("**/assets/index-*.js", (route) => route.abort());
  await page.goto("./autoapply", { waitUntil: "commit" });
  await expect(page.locator("html")).toHaveClass(/light/);
});
