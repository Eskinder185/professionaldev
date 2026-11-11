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

test("renders the Java roadmap through the API integration", async ({ page }) => {
  if (!process.env.LIVE_API) {
    await page.route("**/api/v1/roadmaps", (route) => route.fulfill({
      contentType: "application/json",
      json: [
        {
          id: "java-spring-backend",
          title: "Java and Spring Backend",
          description: "Progress from Java language fundamentals to a tested Spring Boot REST API.",
          targetRole: "Backend Java Developer",
          estimatedWeeks: 14,
          stages: [
            {
              sequence: 1,
              title: "Modern Java",
              outcomes: ["Model data with classes and records", "Use collections and exceptions"],
            },
          ],
        },
      ],
    }));
  }

  await page.goto("./resources/roadmaps");

  await expect(page.getByText("Live API catalog")).toBeVisible();
  await expect(page.getByText("Progress from Java language fundamentals to a tested Spring Boot REST API.")).toBeVisible();
  await expect(page.getByText("Backend Java Developer")).toBeVisible();
});
