import { expect, test, type Page } from "@playwright/test";
import { CLASSIC_RESUME } from "../fixtures/resumes";
import { buildResumeDocx, buildResumePdf } from "../fixtures/files";

const sectionButton = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}( \\(needs review\\))?$`) });
const fileInput = (page: Page) => page.locator('input[type="file"]');
const preview = (page: Page) => page.getByRole("article", { name: /^Page 1 of/ });

async function showPreview(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole("tab", { name: "Preview" }).click();
}

async function importText(page: Page, text: string, name = "resume.txt") {
  await fileInput(page).setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
  await expect(page.getByRole("status")).toContainText("Imported");
}

test("a text import becomes a structured document with headings, aligned dates, and bullet lists", async ({ page, isMobile }) => {
  await page.goto("./resume");
  await importText(page, CLASSIC_RESUME);
  await showPreview(page, isMobile);
  const doc = preview(page);
  await expect(doc.getByRole("heading", { level: 1, name: "Jordan Rivera" })).toBeVisible();
  await expect(doc.getByRole("heading", { level: 2, name: "Experience" })).toBeVisible();
  await expect(doc.getByRole("heading", { level: 2, name: "Education" })).toBeVisible();
  // Bullets are list items, not one paragraph.
  const firstRole = doc.getByRole("list").first();
  await expect(firstRole.getByRole("listitem")).toHaveCount(3);
  await expect(doc.getByText("Jan 2022 – Present")).toBeVisible();
  const paragraphs = await doc.locator("p").evaluateAll((nodes) => nodes.map((node) => node.textContent?.length || 0));
  expect(Math.max(...paragraphs)).toBeLessThan(400);
});

test("structured edits update the preview and survive reload", async ({ page, isMobile }) => {
  await page.goto("./resume");
  await importText(page, CLASSIC_RESUME);
  await sectionButton(page, "Experience").click();
  await page.locator("summary", { hasText: "IT Support Specialist" }).click();
  await page.getByRole("textbox", { name: "Achievements 1" }).first().fill("Resolved 40 tickets per week with documented fixes.");
  await page.getByRole("button", { name: "Add bullet" }).first().click();
  await page.getByRole("textbox", { name: "Achievements 4" }).first().fill("Trained two new technicians.");
  await page.reload();
  await showPreview(page, isMobile);
  await expect(preview(page).getByText("Resolved 40 tickets per week with documented fixes.")).toBeVisible();
  await expect(preview(page).getByRole("list").first().getByRole("listitem")).toHaveCount(4);
});

test("parsing review shows uncertain fields and the original extracted text", async ({ page, isMobile }) => {
  await page.goto("./resume");
  await importText(page, "Pat Lee\npat@example.com\nExperience\nWarehouse Associate, Example Logistics Inc\n• Packed orders.\n");
  if (isMobile) await page.getByRole("tab", { name: /Review/ }).click();
  await expect(page.getByText(/No dates were found for "Warehouse Associate"/)).toBeVisible();
  await page.getByText("Original extracted text").click();
  await expect(page.locator(".rs-source pre")).toContainText("Warehouse Associate, Example Logistics Inc");
  await page.getByRole("button", { name: "Mark reviewed" }).first().click();
  await expect(page.getByText(/No dates were found/)).toHaveCount(0);
});

test("PDF import keeps lines, right-aligned dates, and bullets", async ({ page, isMobile }) => {
  await page.goto("./resume");
  await fileInput(page).setInputFiles({ name: "morgan.pdf", mimeType: "application/pdf", buffer: buildResumePdf() });
  await expect(page.getByRole("status")).toContainText("Imported morgan");
  await sectionButton(page, "Experience").click();
  await page.locator("summary", { hasText: "Network Administrator" }).click();
  await expect(page.getByRole("textbox", { name: "Employer" }).first()).toHaveValue("Front Range Credit Union");
  await expect(page.getByRole("textbox", { name: "Start date" }).first()).toHaveValue("Mar 2021");
  await showPreview(page, isMobile);
  const doc = preview(page);
  await expect(doc.getByRole("heading", { level: 1, name: "Morgan Ellis" })).toBeVisible();
  await expect(doc.getByRole("list").first().getByRole("listitem")).toHaveCount(2);
  await expect(doc.getByText("Jun 2019 – Feb 2021")).toBeVisible();
});

test("DOCX import keeps headings, tabbed dates, and bullet paragraphs", async ({ page, isMobile }) => {
  await page.goto("./resume");
  await fileInput(page).setInputFiles({ name: "casey.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: await buildResumeDocx() });
  await expect(page.getByRole("status")).toContainText("Imported casey");
  await showPreview(page, isMobile);
  const doc = preview(page);
  await expect(doc.getByRole("heading", { level: 1, name: "Casey Brooks" })).toBeVisible();
  await expect(doc.getByText("Buckeye Insurance Group")).toBeVisible();
  await expect(doc.getByText("Aug 2022 – Present")).toBeVisible();
  await expect(doc.getByRole("list").first().getByRole("listitem")).toHaveCount(2);
  await expect(doc.getByText("Columbus State Community College")).toBeVisible();
});

test("printing produces a selectable-text PDF that re-imports with its structure", async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || isMobile, "page.pdf is Chromium desktop only");
  await page.goto("./resume");
  await importText(page, CLASSIC_RESUME);
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  expect(pdf.byteLength).toBeGreaterThan(5000);
  await fileInput(page).setInputFiles({ name: "printed.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByRole("status")).toContainText("Imported printed");
  await sectionButton(page, "Experience").click();
  await page.locator("summary", { hasText: "Help Desk Technician" }).click();
  const role = page.locator("details[open]");
  await expect(role.getByRole("textbox", { name: "Job title" })).toHaveValue("Help Desk Technician");
  await expect(role.getByRole("textbox", { name: "Employer" })).toHaveValue("Capital Tech Solutions");
  await expect(role.getByRole("textbox", { name: "Start date" })).toHaveValue("Jun 2020");
  await expect(role.getByRole("textbox", { name: "Achievements 2" })).toHaveValue("Imaged and deployed 120 laptops during an office migration.");
  await sectionButton(page, "Skills").click();
  await expect(page.getByRole("textbox", { name: "Category name" }).first()).toHaveValue("Operating Systems");
});

test("templates, section order, and paper size change the document", async ({ page, isMobile }) => {
  await page.goto("./resume");
  await importText(page, CLASSIC_RESUME);
  await page.getByRole("tab", { name: "Design" }).click();
  await page.getByRole("radio", { name: /Technical Engineer/ }).first().click();
  await page.getByRole("combobox", { name: "Paper size" }).selectOption("a4");
  await page.getByRole("button", { name: "Move Technical Skills down" }).click();
  await showPreview(page, isMobile);
  await expect(page.locator(".rd-doc.rd-tpl-technical")).toHaveCount(1);
  const headings = await preview(page).getByRole("heading", { level: 2 }).allTextContents();
  expect(headings.slice(0, 3)).toEqual(["PROFESSIONAL SUMMARY", "CERTIFICATIONS", "TECHNICAL SKILLS"]);
  const size = await preview(page).evaluate((node) => node.getBoundingClientRect().height / node.getBoundingClientRect().width);
  expect(size).toBeCloseTo(11.69 / 8.27, 2);
});

test("unsupported files report a clear error", async ({ page }) => {
  await page.goto("./resume");
  await fileInput(page).setInputFiles({ name: "unsupported.bin", mimeType: "application/octet-stream", buffer: Buffer.from("sample") });
  await expect(page.getByRole("alert")).toContainText("Unsupported file type");
});

for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
  test(`résumé studio has no horizontal overflow at ${width}px`, async ({ page, isMobile }) => {
    test.skip(isMobile, "viewport sweep runs once on desktop");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./resume");
    await importText(page, CLASSIC_RESUME);
    for (const tab of width < 1024 ? ["Edit", "Preview", "Review"] : [null]) {
      if (tab) await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `overflow on ${tab ?? "desktop"}`).toBeLessThanOrEqual(0);
    }
    if (width < 1024) await page.getByRole("tab", { name: "Preview" }).click();
    const box = await preview(page).boundingBox();
    expect(box && box.width).toBeGreaterThan(0);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  });
}

for (const format of ["PDF", "DOCX"] as const) {
  test(`${format} export downloads a file that re-imports with its structure`, async ({ page, isMobile }) => {
    await page.goto("./resume");
    await importText(page, CLASSIC_RESUME);
    await showPreview(page, isMobile);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: format, exact: true }).click()]);
    expect(download.suggestedFilename()).toBe(`resume.${format.toLowerCase()}`);
    const path = await download.path();
    const { readFileSync } = await import("node:fs");
    const buffer = readFileSync(path!);
    expect(buffer.byteLength).toBeGreaterThan(1500);
    await fileInput(page).setInputFiles({ name: `exported.${format.toLowerCase()}`, mimeType: format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer });
    await expect(page.getByRole("status")).toContainText("Imported exported");
    if (isMobile) await page.getByRole("tab", { name: "Edit" }).click();
    await sectionButton(page, "Experience").click();
    await page.locator("summary", { hasText: "Help Desk Technician" }).click();
    const role = page.locator("details[open]");
    await expect(role.getByRole("textbox", { name: "Employer" })).toHaveValue("Capital Tech Solutions");
    await expect(role.getByRole("textbox", { name: "Location" })).toHaveValue("Round Rock, TX");
    await expect(role.getByRole("textbox", { name: "Start date" })).toHaveValue("Jun 2020");
    await expect(role.getByRole("textbox", { name: "End date" })).toHaveValue("Dec 2021");
    await expect(role.getByRole("textbox", { name: "Achievements 2" })).toHaveValue("Imaged and deployed 120 laptops during an office migration.");
    await sectionButton(page, "Certifications").click();
    await expect(page.locator("summary").filter({ hasText: "CompTIA Network+" })).toBeVisible();
  });
}
