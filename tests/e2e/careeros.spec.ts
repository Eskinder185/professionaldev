import { expect, test } from "@playwright/test";

test("workspace navigation and real empty states", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./dashboard");
  await expect(page.getByRole("heading", { name: "Your career, moving forward." })).toBeVisible();
  await expect(page.getByText("No live jobs connected yet")).toBeVisible();
  await page.getByRole("button", { name: "Choose a career goal" }).click();
  await page.getByRole("textbox", { name: "Target career" }).fill("Data Analyst");
  await page.getByRole("textbox", { name: "Target career" }).press("Enter");
  await page.reload();
  await expect(page.getByRole("button", { name: "Data Analyst" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("user-added job enters the application tracker", async ({ page, isMobile }) => {
  await page.goto("./jobs");
  await expect(page.getByText("Live job search is not connected.")).toBeVisible();
  await page.getByRole("button", { name: "Save a posting" }).click();
  const dialog = page.getByRole("dialog", { name: "Save a job posting" });
  await dialog.getByLabel("Job title").fill("Analyst Intern");
  await dialog.getByLabel("Company").fill("Example Company");
  await dialog.getByRole("button", { name: "Save posting" }).click();
  if (isMobile) await expect(page.getByRole("heading", { name: "Analyst Intern" })).toBeVisible();
  else await expect(page.getByRole("button", { name: /Analyst Intern/ })).toBeVisible();
  await page.getByRole("button", { name: "Add to tracker" }).click();
  await page.goto("./applications");
  await expect(page.getByText("Analyst Intern")).toBeVisible();
});

test("application status and timeline reflect the same persisted record", async ({ page }) => {
  await page.goto("./applications");
  await page.getByRole("button", { name: "New application", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New application" });
  await dialog.getByLabel("Company").fill("Example Company");
  await dialog.getByLabel("Role").fill("Analyst");
  await dialog.getByRole("button", { name: "Add application" }).click();
  await page.getByRole("combobox", { name: "Move Analyst at Example Company" }).selectOption("Interview");
  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("combobox", { name: "Status for Analyst" })).toHaveValue("Interview");
  await page.getByRole("button", { name: "Timeline" }).click();
  await expect(page.getByText("Date not set")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("combobox", { name: "Status for Analyst" })).toHaveValue("Interview");
});

test("saved jobs can be edited and removal requires confirmation", async ({ page }) => {
  await page.goto("./jobs");
  await page.getByRole("button", { name: "Save a posting" }).click();
  const dialog = page.getByRole("dialog", { name: "Save a job posting" });
  await expect(dialog.getByLabel("Job title")).toBeFocused();
  await dialog.getByLabel("Job title").fill("Original Role");
  await dialog.getByLabel("Company").fill("Example Company");
  await dialog.getByLabel("Relevant skills, comma separated").fill("TypeScript");
  await dialog.getByRole("button", { name: "Save posting" }).click();
  await page.getByRole("button", { name: "Edit posting" }).click();
  await page.getByRole("dialog", { name: "Edit saved job" }).getByLabel("Job title").fill("Updated Role");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Updated Role" })).toBeVisible();
  page.once("dialog", (prompt) => prompt.dismiss());
  await page.getByRole("button", { name: "Remove saved job" }).click();
  await expect(page.getByRole("heading", { name: "Updated Role" })).toBeVisible();
  page.once("dialog", (prompt) => prompt.accept());
  await page.getByRole("button", { name: "Remove saved job" }).click();
  await expect(page.getByRole("heading", { name: "Updated Role" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("No saved postings yet")).toBeVisible();
});

test("quick create opens a keyboard accessible application form without an invented date", async ({ page }) => {
  await page.goto("./dashboard");
  await page.getByRole("link", { name: "New application" }).click();
  const dialog = page.getByRole("dialog", { name: "New application" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Company")).toBeFocused();
  await expect(dialog.getByLabel("Relevant date (optional)")).toBeEmpty();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New application" })).toBeFocused();
});

test("settings backup round trips application records and raw legacy preferences", async ({ page }) => {
  await page.goto("./settings");
  await page.evaluate(() => {
    localStorage.setItem("appTracker:items", JSON.stringify([{ id: "test-app", company: "Backup Co", role: "Analyst", status: "Saved", date: "" }]));
    localStorage.setItem("pd:resources:certs:path", "cloud");
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export my data" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const parts: Buffer[] = [];
  for await (const chunk of stream) parts.push(Buffer.from(chunk));
  const backup = Buffer.concat(parts);
  const parsed = JSON.parse(backup.toString());
  expect(parsed.entries["appTracker:items"]).toContain("Backup Co");
  expect(parsed.entries["pd:resources:certs:path"]).toBe("cloud");
  await page.evaluate(() => { localStorage.removeItem("appTracker:items"); localStorage.removeItem("pd:resources:certs:path"); });
  page.once("dialog", (prompt) => prompt.accept());
  await Promise.all([
    page.waitForEvent("framenavigated"),
    page.locator('input[type="file"]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: backup }),
  ]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pd:resources:certs:path"))).toBe("cloud");
  await page.goto("./applications");
  await expect(page.getByText("Backup Co")).toBeVisible();
});

test("résumé import and local review handle text and reject unsupported files", async ({ page, isMobile }) => {
  await page.goto("./resume");
  await page.locator('input[type="file"]').setInputFiles({
    name: "resume.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Summary\nBuilt and tested a TypeScript project."),
  });
  if (isMobile) await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByRole("article", { name: "Page 1 of 1" }).getByText("Built and tested a TypeScript project.")).toBeVisible();
  if (isMobile) await page.getByRole("tab", { name: /^Review/ }).click();
  await expect(page.getByRole("heading", { name: "Document checks" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "unsupported.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("sample"),
  });
  await expect(page.getByRole("alert")).toContainText("Unsupported file type");
});

test("coach history and reduced-motion setting persist without an external service", async ({ page }) => {
  await page.goto("./coach");
  await page.getByRole("textbox", { name: "Message Career Coach" }).fill("How should I prepare an interview?");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.reload();
  await expect(page.getByText("How should I prepare an interview?")).toBeVisible();
  await page.goto("./settings");
  await page.getByRole("button", { name: "Off", exact: true }).click();
  await expect(page.getByRole("button", { name: "On", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "On", exact: true })).toBeVisible();
});

test("academy progress persists and is reflected on dashboard", async ({ page }) => {
  await page.goto("./academy");
  await page.getByRole("button", { name: /Turn experience into evidence/ }).click();
  await page.getByRole("button", { name: "Mark complete" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Mark incomplete" })).toBeVisible();
  await page.goto("./dashboard");
  await expect(page.getByText("Lessons completed").locator("..").getByText("1")).toBeVisible();
});

test("workspace has no page-level horizontal overflow on phone and desktop", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    for (const route of ["dashboard", "jobs", "academy", "resume", "applications"]) {
      await page.goto(`./${route}`);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${route} at ${width}px`).toBe(false);
    }
  }
});

test("focus tasks and résumé versions survive reload", async ({ page }) => {
  await page.goto("./dashboard");
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("textbox", { name: "Task title" }).fill("Review portfolio case study");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("Review portfolio case study");
  await page.goto("./resume");
  await page.getByRole("button", { name: "New version" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("Taylor Student");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("Taylor Student");
});

test("workspace overlays close with Escape and sidebar preference persists", async ({ page, isMobile }) => {
  await page.goto("./dashboard");
  await expect(page.getByRole("heading", { name: "Your career, moving forward." })).toBeVisible();
  await page.keyboard.press("/");
  await expect(page.getByRole("dialog", { name: "Search workspace" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Search workspace" })).toHaveCount(0);
  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog", { name: "Mobile workspace navigation" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Mobile workspace navigation" })).toHaveCount(0);
  } else {
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  }
});
