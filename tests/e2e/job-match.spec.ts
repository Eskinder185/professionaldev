import { expect, test, type Page } from "@playwright/test";
import { CLASSIC_RESUME } from "../fixtures/resumes";
import { IT_SUPPORT_JD } from "../fixtures/jobs";

async function analyzed(page: Page, isMobile: boolean) {
  await page.goto("./resume");
  await page.locator('input[type="file"]').setInputFiles({ name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from(CLASSIC_RESUME) });
  await expect(page.getByRole("status")).toContainText("Imported");
  await page.getByRole("tab", { name: isMobile ? /^Requirements/ : /^Job match/ }).click();
  await page.getByRole("textbox", { name: "Paste the job description" }).fill(IT_SUPPORT_JD);
  await page.getByRole("button", { name: "Analyze requirements" }).click();
}

const req = (page: Page, term: string) => page.locator(".rs-req").filter({ has: page.getByText(term, { exact: true }) });
const suggestion = (page: Page, kind: string, title: string) => page.locator(".rs-suggestion").filter({ hasText: kind }).filter({ has: page.getByText(title, { exact: true }) });
const docText = (page: Page) => page.locator(".rd-pages").innerText();

test("match analysis shows an explainable score, groups, and evidence", async ({ page, isMobile }) => {
  await analyzed(page, isMobile);
  await page.getByRole("button", { name: "See match analysis and suggestions" }).click();
  await expect(page.getByRole("heading", { name: "Job Description Match Score" })).toBeVisible();
  await expect(page.getByText(/not a score from an employer's ATS/)).toBeVisible();
  await expect(page.locator(".rs-score-value strong")).toHaveText(/^\d{1,2}$/);
  await expect(page.getByText("Required qualifications met")).toBeVisible();
  await expect(page.getByText(/Document quality \(separate, not in the score\)/)).toBeVisible();
  await page.getByText("How this score is calculated").click();
  await expect(page.getByText(/80% requirement coverage \+ 20% evidence quality/)).toBeVisible();
  await page.locator("summary", { hasText: "Requirements matched" }).click();
  const powershell = page.locator(".rs-group-matched li").filter({ hasText: "PowerShell" });
  await expect(powershell.getByText("Demonstrated")).toBeVisible();
  await expect(powershell.locator("blockquote")).toContainText("Automated new-hire account provisioning");
  await expect(page.locator(".rs-group-missing li").filter({ hasText: "HIPAA" })).toBeVisible();
});

test("a confirmed skill is applied only after approval and the score recalculates", async ({ page, isMobile }) => {
  await analyzed(page, isMobile);
  await req(page, "HIPAA").getByRole("radio", { name: "I have this" }).click();
  await page.getByRole("tab", { name: "Match & suggestions" }).click();
  if (isMobile) await page.getByRole("tab", { name: "Preview" }).click();
  expect(await docText(page)).not.toContain("HIPAA");
  if (isMobile) await page.getByRole("tab", { name: /^Requirements/ }).click();
  const card = suggestion(page, "Add verified skill", "HIPAA");
  await expect(card.getByText("Based on: Your answer: I have this")).toBeVisible();
  await card.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByRole("status").first()).toContainText("Applied: Add verified skill (HIPAA)");
  await expect(page.locator(".rs-score-change")).toContainText("“HIPAA”: missing → mentioned");
  if (isMobile) await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.locator(".rd-pages")).toContainText("Compliance & Domain: HIPAA");
});

test("rejected suggestions leave the résumé unchanged and stay hidden", async ({ page, isMobile }) => {
  await analyzed(page, isMobile);
  await page.getByRole("tab", { name: "Match & suggestions" }).click();
  const summary = page.locator(".rs-suggestion").filter({ hasText: "Tailor professional summary" });
  await expect(summary).toHaveCount(1);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("pd:careeros:resume-documents") || "[]")[0].resume.summary);
  await summary.getByRole("button", { name: "Reject" }).click();
  await expect(summary).toHaveCount(0);
  await page.reload();
  if (isMobile) await page.getByRole("tab", { name: /^Requirements/ }).click();
  else await page.getByRole("tab", { name: /^Job match/ }).click();
  await page.getByRole("tab", { name: "Match & suggestions" }).click();
  await expect(page.locator(".rs-suggestion").filter({ hasText: "Tailor professional summary" })).toHaveCount(0);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("pd:careeros:resume-documents") || "[]")[0].resume.summary);
  expect(after).toBe(before);
});

test("example bullets cannot be applied until placeholders are replaced", async ({ page, isMobile }) => {
  await analyzed(page, isMobile);
  await req(page, "TCP/IP").getByRole("radio", { name: "I have this" }).click();
  await page.getByRole("tab", { name: "Match & suggestions" }).click();
  const card = suggestion(page, "Improve achievement bullet", "TCP/IP");
  await expect(card.getByRole("button", { name: "Accept" })).toBeDisabled();
  await card.getByRole("button", { name: "Edit" }).click();
  await card.getByRole("textbox").fill("Diagnosed TCP/IP addressing conflicts for 40 users, restoring network access the same day.");
  await card.getByRole("button", { name: "Accept" }).click();
  if (isMobile) await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.locator(".rd-pages")).toContainText("Diagnosed TCP/IP addressing conflicts for 40 users");
});
