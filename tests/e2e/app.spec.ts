import { expect, test } from "@playwright/test";

test("starts without fatal browser errors and navigates to important routes", async ({ page }) => {
  const fatalErrors: string[] = [];
  page.on("pageerror", (error) => fatalErrors.push(error.message));

  await page.goto("./");
  await expect(page).toHaveTitle("ProfessionalDev CareerOS");
  await expect(page.getByRole("main")).toBeVisible();

  const routes = ["self-assessment", "career-tools", "resources"];
  for (const route of routes) {
    await page.goto(`./${route}`);
    await expect(page.getByRole("main")).toBeVisible();
  }

  expect(fatalErrors).toEqual([]);
});

test("main navigation works at desktop and mobile widths", async ({ page, isMobile }) => {
  await page.goto("./");

  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }

  await page.getByRole("link", { name: "Build: career tools" }).click();
  await expect(page).toHaveURL(/\/career-tools$/);
  await expect(page.getByRole("main")).toBeVisible();
});

test("browser-stored user data survives startup and reload", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pd:career:resume:draft", '{"summary":"Keep this draft"}');
    localStorage.setItem("pd:resources:skills:list", '[{"name":"TypeScript"}]');
  });

  await page.goto("./");
  await page.reload();

  const persisted = await page.evaluate(() => ({
    resume: localStorage.getItem("pd:career:resume:draft"),
    skills: localStorage.getItem("pd:resources:skills:list"),
    migrationVersion: localStorage.getItem("pd:migrations:version"),
  }));

  expect(persisted).toEqual({
    resume: '{"summary":"Keep this draft"}',
    skills: '[{"name":"TypeScript"}]',
    migrationVersion: "1",
  });
});

test("exports an existing STAR story as a PDF download", async ({ page }) => {
  await page.goto("./career-tools/star-builder");
  await page.getByPlaceholder("e.g., Optimized build pipeline").fill("Reliable release process");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("star-story.pdf");
});

