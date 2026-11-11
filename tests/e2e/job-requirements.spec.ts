import { expect, test, type Page } from "@playwright/test";
import { CLASSIC_RESUME } from "../fixtures/resumes";
import { IT_SUPPORT_JD, NO_TECH_JD, SECURITY_JD } from "../fixtures/jobs";

async function setup(page: Page, isMobile: boolean, description: string) {
  await page.goto("./resume");
  await page.locator('input[type="file"]').setInputFiles({ name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from(CLASSIC_RESUME) });
  await expect(page.getByRole("status")).toContainText("Imported");
  if (isMobile) await page.getByRole("tab", { name: /^Requirements/ }).click();
  else await page.getByRole("tab", { name: /^Job match/ }).click();
  await page.getByRole("textbox", { name: "Target job title" }).fill("Cloud Security Analyst");
  await page.getByRole("textbox", { name: "Paste the job description" }).fill(description);
  await page.getByRole("button", { name: "Analyze requirements" }).click();
}

const requirement = (page: Page, term: string) => page.locator(".rs-req").filter({ has: page.getByText(term, { exact: true }) });

test("analysis groups detected requirements into categories and preselects them", async ({ page, isMobile }) => {
  await setup(page, isMobile, SECURITY_JD);
  await expect(page.getByRole("status")).toContainText("All are selected for review");
  await expect(page.getByRole("heading", { name: /^Security/, level: 4 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Cloud Platforms/, level: 4 })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Check AWS IAM for coverage" })).toBeChecked();
  await expect(requirement(page, "AWS IAM").getByRole("combobox", { name: "Requirement type for AWS IAM" })).toHaveValue("responsibility");
  await expect(requirement(page, "CISSP").getByRole("combobox", { name: "Requirement type for CISSP" })).toHaveValue("preferred");
  await requirement(page, "AWS IAM").getByText("From the job description").click();
  await expect(requirement(page, "AWS IAM").locator("mark")).toHaveText("AWS Identity and Access Management");
  await expect(requirement(page, "XSOAR").getByText("Check this")).toBeVisible();
});

test("users can add, recategorize, reclassify, answer, and remove requirements, and changes persist", async ({ page, isMobile }) => {
  await setup(page, isMobile, IT_SUPPORT_JD);
  await page.getByRole("textbox", { name: "Requirement", exact: true }).fill("Jamf");
  await page.getByRole("combobox", { name: "Category", exact: true }).fill("Device management");
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("preferred");
  await page.getByRole("button", { name: "Add requirement" }).click();
  await expect(requirement(page, "Jamf").getByText("Added by you")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Device management/, level: 4 })).toBeVisible();

  const dns = requirement(page, "DNS");
  await dns.getByRole("combobox", { name: "Requirement type for DNS" }).selectOption("preferred");
  await dns.getByRole("combobox", { name: "Category for DNS" }).fill("Core networking");
  await dns.getByRole("combobox", { name: "Category for DNS" }).press("Enter");
  await expect(page.getByRole("heading", { name: /^Core networking/, level: 4 })).toBeVisible();
  await requirement(page, "DNS").getByRole("radio", { name: "I have this" }).click();
  await requirement(page, "DHCP").getByRole("radio", { name: "Not sure" }).click();
  await page.getByRole("button", { name: "Remove HIPAA" }).click();
  await expect(page.getByRole("status")).toContainText("Re-analysis will not add it back");

  await page.reload();
  if (isMobile) await page.getByRole("tab", { name: /^Requirements/ }).click();
  else await page.getByRole("tab", { name: /^Job match/ }).click();
  await expect(requirement(page, "DNS").getByRole("radio", { name: "I have this" })).toHaveAttribute("aria-checked", "true");
  await expect(requirement(page, "DNS").getByRole("combobox", { name: "Requirement type for DNS" })).toHaveValue("preferred");
  await expect(requirement(page, "DHCP").getByRole("radio", { name: "Not sure" })).toHaveAttribute("aria-checked", "true");
  await expect(requirement(page, "Jamf")).toBeVisible();
  await expect(requirement(page, "HIPAA")).toHaveCount(0);

  await page.getByRole("button", { name: "Re-analyze requirements" }).click();
  await expect(requirement(page, "HIPAA")).toHaveCount(0);
  await expect(requirement(page, "Jamf")).toBeVisible();
  await expect(requirement(page, "DNS").getByRole("radio", { name: "I have this" })).toHaveAttribute("aria-checked", "true");
});

test("confirming a requirement never adds it to the résumé", async ({ page, isMobile }) => {
  await setup(page, isMobile, SECURITY_JD);
  await requirement(page, "Splunk").getByRole("radio", { name: "I have this" }).click();
  await requirement(page, "CISSP").getByRole("radio", { name: "I have this" }).click();
  if (isMobile) await page.getByRole("tab", { name: "Preview" }).click();
  const doc = page.getByRole("article", { name: /^Page 1 of/ });
  await expect(doc.getByRole("heading", { level: 1, name: "Jordan Rivera" })).toBeVisible();
  await expect(page.locator(".rd-pages")).not.toContainText("Splunk");
  await expect(page.locator(".rd-pages")).not.toContainText("CISSP");
  const stored = await page.evaluate(() => localStorage.getItem("pd:careeros:resume-documents") || "");
  const resume = JSON.parse(stored)[0].resume;
  expect(JSON.stringify(resume)).not.toContain("Splunk");
  expect(JSON.stringify(resume)).not.toContain("CISSP");
});

test("filters and bulk selection update the summary", async ({ page, isMobile }) => {
  await setup(page, isMobile, IT_SUPPORT_JD);
  await page.getByRole("combobox", { name: "Show" }).selectOption("preferred");
  await expect(page.locator(".rs-req")).toHaveCount(3);
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.locator(".rs-req-summary")).toContainText(/^0 of \d+ selected/);
  await page.getByRole("button", { name: "Select all" }).click();
  await expect(page.locator(".rs-req-summary")).not.toContainText(/^0 of/);
});

test("descriptions without recognizable requirements say so and allow manual entry", async ({ page, isMobile }) => {
  await setup(page, isMobile, NO_TECH_JD);
  await expect(page.getByText("No recognizable requirements were found in this description.")).toBeVisible();
  await page.getByRole("textbox", { name: "Requirement", exact: true }).fill("Customer service");
  await page.getByRole("button", { name: "Add requirement" }).click();
  await expect(requirement(page, "Customer service")).toBeVisible();
});

for (const width of [320, 390, 768, 1440]) {
  test(`job match panel fits without horizontal overflow at ${width}px`, async ({ page, isMobile }) => {
    test.skip(isMobile, "viewport sweep runs on desktop");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./resume");
    await page.locator('input[type="file"]').setInputFiles({ name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from(CLASSIC_RESUME) });
    await expect(page.getByRole("status")).toContainText("Imported");
    await page.getByRole("tab", { name: width < 1024 ? /^Requirements/ : /^Job match/ }).click();
    await page.getByRole("textbox", { name: "Paste the job description" }).fill(SECURITY_JD);
    await page.getByRole("button", { name: "Analyze requirements" }).click();
    await expect(page.locator(".rs-req").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const box = await page.locator(".rs-req").first().boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  });
}
