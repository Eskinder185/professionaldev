import { expect, test, type Page } from "@playwright/test";
import { auditContrast, setTheme, type ContrastProblem } from "./helpers/contrast";
import { watchLocalRequests } from "./helpers/mockOllama";

/**
 * Cloud AI is shown honestly: every service is "Setup required", there is no key field, and
 * nothing is sent to any cloud service or to this computer just by looking at the options.
 */
const report = (problems: ContrastProblem[]) => problems.map((p) => `${p.kind} ${p.ratio || ""} ${p.selector} "${p.text}" ${p.color} on ${p.background}`).join("\n");
const dialog = (page: Page) => page.getByRole("dialog", { name: "Use a cloud AI" });
const CLOUD_HOSTS = /api\.openai\.com|generativelanguage\.googleapis\.com|api\.anthropic\.com/;

function watchCloudRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (CLOUD_HOSTS.test(request.url())) seen.push(request.url());
  });
  return seen;
}

test("the cloud options say plainly that cloud AI is not available yet, and ask for no key", async ({ page }) => {
  const cloud = watchCloudRequests(page);
  const local = watchLocalRequests(page);
  await page.goto("./dashboard");
  await page.getByRole("button", { name: "Use a cloud AI" }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText("Cloud AI isn’t available yet.")).toBeVisible();
  await expect(dialog(page).getByText(/Nothing is sent to any cloud service/)).toBeVisible();

  for (const id of ["openai", "gemini", "anthropic", "custom_cloud"]) {
    await expect(page.getByTestId(`cloud-status-${id}`)).toHaveText("Setup required");
  }
  await expect(dialog(page).getByText("OpenAI", { exact: true })).toBeVisible();
  await expect(dialog(page).getByText("Google Gemini", { exact: true })).toBeVisible();
  await expect(dialog(page).getByText("Anthropic Claude", { exact: true })).toBeVisible();

  // No way to enter a key, and none of the cards claims to be connected.
  await expect(dialog(page).locator("input, textarea")).toHaveCount(0);
  await expect(dialog(page)).not.toContainText(/\bconnected\b|\bready\b/i);

  // The comparison is a real table for screen readers.
  await expect(dialog(page).getByRole("table", { name: "Local AI compared with cloud AI" })).toBeVisible();
  await expect(dialog(page).getByRole("rowheader", { name: "Cost" })).toBeVisible();

  await dialog(page).getByText("Why can’t I just paste a key?").click();
  await expect(dialog(page)).toContainText("somewhere strong");

  expect(cloud, "no request to any cloud AI service").toEqual([]);
  expect(local, "looking at cloud options does not touch this computer").toEqual([]);
});

test("from the cloud options a person can go back to local AI, which still asks first", async ({ page }) => {
  const local = watchLocalRequests(page);
  await page.goto("./dashboard");
  await page.getByRole("button", { name: "Use a cloud AI" }).click();
  await dialog(page).getByRole("button", { name: "Use AI on this computer instead" }).click();
  await expect(page.getByRole("dialog", { name: "Connect your AI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Allow and check" })).toBeVisible();
  expect(local).toEqual([]);
});

test("a person who already allowed checking is not checked when they only open the cloud options", async ({ page }) => {
  const local = watchLocalRequests(page);
  await page.addInitScript(() => localStorage.setItem("pd:careeros:ai-discovery-consent", "allowed"));
  await page.goto("./dashboard");
  await page.getByRole("button", { name: "Use a cloud AI" }).click();
  await expect(dialog(page)).toBeVisible();
  await page.waitForTimeout(500);
  expect(local, "opening cloud options must not trigger detection").toEqual([]);
});

test("the Connect sheet links to the cloud options", async ({ page }) => {
  await page.goto("./dashboard");
  await page.getByRole("button", { name: "Connect your AI" }).click();
  await page.getByRole("button", { name: "See cloud options" }).click();
  await expect(dialog(page)).toBeVisible();
});

test("Escape closes the cloud options and returns focus", async ({ page }) => {
  await page.goto("./dashboard");
  const trigger = page.getByRole("button", { name: "Use a cloud AI" });
  await trigger.click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("the cloud options fit narrow screens", async ({ page, isMobile }) => {
  test.skip(isMobile, "viewport sweep runs once on desktop");
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("./dashboard");
    await page.getByRole("button", { name: "Use a cloud AI" }).click();
    await expect(dialog(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}px`).toBeLessThanOrEqual(0);
    const box = await dialog(page).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape");
  }
});

for (const theme of ["dark", "light"] as const) {
  test(`the cloud options are readable in ${theme} mode`, async ({ page, isMobile }) => {
    test.skip(isMobile, "contrast is viewport independent");
    await setTheme(page, theme);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("./dashboard");
    await page.getByRole("button", { name: "Use a cloud AI" }).click();
    await dialog(page).getByText("Why can’t I just paste a key?").click();
    const problems = await auditContrast(page, ".cos-dialog", { dark: theme === "dark" });
    expect(problems, report(problems)).toEqual([]);
  });
}
