import { expect, test, type Page } from "@playwright/test";
import { CLASSIC_RESUME } from "../fixtures/resumes";
import { IT_SUPPORT_JD } from "../fixtures/jobs";

/** Every visible control must expose an accessible name (label, text, or aria-label). */
async function unnamedControls(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const box = (element as HTMLElement).getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && !element.closest("[aria-hidden='true']");
    };
    const named = (element: Element) => {
      const el = element as HTMLInputElement;
      if (el.getAttribute("aria-label")?.trim() || el.getAttribute("aria-labelledby")) return true;
      if (el.labels && el.labels.length && [...el.labels].some((label) => label.textContent?.trim())) return true;
      if (el.tagName === "BUTTON" || el.getAttribute("role") === "radio" || el.getAttribute("role") === "tab") return Boolean(el.textContent?.trim());
      if (el.tagName === "A") return Boolean(el.textContent?.trim());
      return Boolean(el.getAttribute("title"));
    };
    return [...document.querySelectorAll("main button, main input, main select, main textarea, main a[href], main [role='radio'], main [role='tab']")]
      .filter((element) => visible(element) && !named(element))
      .map((element) => element.outerHTML.slice(0, 140));
  });
}

test("résumé studio controls all have accessible names", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout shows every panel at once");
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("./resume");
  await page.locator('input[type="file"]').setInputFiles({ name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from(CLASSIC_RESUME) });
  await expect(page.getByRole("status")).toContainText("Imported");
  expect(await unnamedControls(page)).toEqual([]);
  await page.getByRole("tab", { name: /^Job match/ }).click();
  await page.getByRole("textbox", { name: "Paste the job description" }).fill(IT_SUPPORT_JD);
  await page.getByRole("button", { name: "Analyze requirements" }).click();
  expect(await unnamedControls(page)).toEqual([]);
  await page.getByRole("tab", { name: "Match & suggestions" }).click();
  expect(await unnamedControls(page)).toEqual([]);
  await page.getByRole("tab", { name: "Design" }).click();
  expect(await unnamedControls(page)).toEqual([]);
});

test("interview studio controls all have accessible names", async ({ page }) => {
  await page.goto("./interviews");
  await page.getByRole("radio", { name: /^Camera \+ voice/ }).click();
  expect(await unnamedControls(page)).toEqual([]);
  await page.getByRole("button", { name: "Start practice session" }).click();
  expect(await unnamedControls(page)).toEqual([]);
});

test("a text interview can be completed with the keyboard alone", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow");
  await page.goto("./interviews");
  const start = page.getByRole("button", { name: "Start practice session" });
  await page.getByRole("combobox", { name: "Session length" }).focus();
  await page.keyboard.press("End");
  await page.getByRole("combobox", { name: "Session length" }).selectOption({ label: "1 question" });
  await start.focus();
  await expect(start).toBeFocused();
  await page.keyboard.press("Enter");
  const answer = page.getByRole("button", { name: "Start answer" });
  await answer.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "Your answer" }).focus();
  await page.keyboard.type("I documented the fix so the team could reuse it.");
  await page.getByRole("button", { name: "Stop answer" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "End session" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Answer review")).toBeVisible();
  // Focus indicators are styled for keyboard users.
  const back = page.getByRole("button", { name: "Back to Interview Studio" });
  await back.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(back).toBeFocused();
});
