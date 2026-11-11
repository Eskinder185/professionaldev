import { expect, test, type Page } from "@playwright/test";
import { auditContrast, setTheme, type ContrastProblem } from "./helpers/contrast";
import { mockNothingRunning, mockOllama, watchLocalRequests } from "./helpers/mockOllama";

/**
 * Home AI panel and Connect sheet, in real Chromium against a SIMULATED Ollama.
 * These prove the CareerOS flow (consent, discovery, selection, a real streamed test message,
 * honest status). They do not prove a real Ollama or LM Studio works.
 */
const report = (problems: ContrastProblem[]) => problems.map((p) => `${p.kind} ${p.ratio || ""} ${p.selector} "${p.text}" ${p.color} on ${p.background}`).join("\n");
const open = async (page: Page) => {
  await page.goto("./dashboard");
  await page.getByRole("button", { name: "Connect your AI" }).click();
  await expect(page.getByRole("dialog", { name: "Connect your AI" })).toBeVisible();
};
const sheet = (page: Page) => page.getByRole("dialog", { name: "Connect your AI" });

test("a first-time visitor sees one clear action and nothing is contacted before they agree", async ({ page }) => {
  const local = watchLocalRequests(page);
  await mockOllama(page);
  await page.goto("./dashboard");
  const hero = page.getByTestId("home-ai-hero");
  await expect(hero.getByRole("heading", { name: "Your AI. Your career. Your control." })).toBeVisible();
  await expect(hero.getByRole("button", { name: "Connect your AI" })).toBeVisible();
  await expect(hero.getByText(/Connect your own AI to find jobs, tailor your résumé/)).toBeVisible();
  // No technical vocabulary on the home screen.
  await expect(hero).not.toContainText(/endpoint|port|CORS|localhost|127\.0\.0\.1|handshake/i);

  await hero.getByRole("button", { name: "Connect your AI" }).click();
  await expect(sheet(page).getByText(/only checks the standard addresses for Ollama and LM Studio/)).toBeVisible();
  await expect(sheet(page).getByText(/Nothing leaves your computer/)).toBeVisible();
  expect(local, "no request before consent").toEqual([]);

  await sheet(page).getByRole("button", { name: "Not now" }).click();
  await expect(sheet(page)).toHaveCount(0);
  expect(local, "no request after declining").toEqual([]);

  // The choice is remembered: reopening explains it and still does not check.
  await page.reload();
  await page.getByRole("button", { name: "Connect your AI" }).click();
  await expect(sheet(page).getByText(/you chose not to check this computer/i)).toBeVisible();
  expect(local).toEqual([]);
});

test("allowing detection finds real models, connects, and sends a real test message (simulated Ollama)", async ({ page }) => {
  const server = await mockOllama(page, { models: [{ name: "llama3.2:3b", size: 2_019_393_189, parameter_size: "3.2B" }, { name: "qwen2.5:0.5b", size: 397_821_319, parameter_size: "0.5B" }] });
  await open(page);
  await sheet(page).getByRole("button", { name: "Allow and check" }).click();

  await expect(sheet(page).getByText("Ollama is running")).toBeVisible();
  const card = sheet(page).locator(".ai-model").filter({ hasText: "llama3.2:3b" });
  await expect(card).toContainText("1.9 GB");
  await expect(card).toContainText("Good for most CareerOS tasks.");
  // A tiny model is not oversold.
  await expect(sheet(page).locator(".ai-model").filter({ hasText: "qwen2.5:0.5b" })).toContainText(/May struggle with/);
  // LM Studio is not running; it must not appear as found, and the happy path stays quiet about it.
  await expect(sheet(page).getByText("LM Studio is running")).toHaveCount(0);
  await expect(sheet(page).getByText(/LM Studio wasn.t detected/)).toBeVisible();
  await expect(sheet(page).getByText("Open but still not found?")).toHaveCount(0);
  await expect(sheet(page).getByRole("checkbox", { name: "Remember my choice on this device" })).toBeChecked();

  await sheet(page).getByRole("button", { name: "Use llama3.2:3b" }).click();
  await expect(sheet(page).getByText(/llama3\.2:3b replied\. Your AI is ready\./)).toBeVisible();
  await expect(sheet(page).locator(".ai-reply")).toContainText("Hello! I can help tailor your résumé.");
  await expect(sheet(page).getByText(/not a simulation/)).toBeVisible();
  expect(server.paths).toEqual(expect.arrayContaining(["GET /api/version", "GET /api/tags", "POST /api/chat"]));

  await sheet(page).getByRole("button", { name: "Done" }).click();
  const strip = page.getByTestId("home-ai-strip");
  await expect(strip).toContainText("Ollama · llama3.2:3b");
  await expect(strip).toContainText("On this computer");
  await expect(page.getByTestId("home-ai-status")).toHaveText("Ready");
  await expect(strip.getByRole("link", { name: /Continue with Autopilot/ })).toBeVisible();
});

test("a saved connection never claims Ready until it replies again", async ({ page }) => {
  await mockOllama(page);
  await open(page);
  await sheet(page).getByRole("button", { name: "Allow and check" }).click();
  await sheet(page).getByRole("button", { name: "Use llama3.2:3b" }).click();
  await expect(sheet(page).getByText(/Your AI is ready/)).toBeVisible();
  await sheet(page).getByRole("button", { name: "Done" }).click();

  await page.reload();
  const strip = page.getByTestId("home-ai-strip");
  await expect(strip).toContainText("Ollama · llama3.2:3b");
  await expect(page.getByTestId("home-ai-status")).toHaveText("Not checked yet");
  await expect(strip.getByRole("link", { name: /Continue with Autopilot/ })).toHaveCount(0);

  await strip.getByRole("button", { name: "Test AI" }).click();
  await expect(page.getByTestId("home-ai-status")).toHaveText("Ready");
  await expect(strip.getByText(/replied\. Your AI is ready/)).toBeVisible();
});

test("a running app with no models is explained, not reported as missing software", async ({ page }) => {
  await mockOllama(page, { models: [] });
  await open(page);
  await sheet(page).getByRole("button", { name: "Allow and check" }).click();
  await expect(sheet(page).getByText(/Ollama is running, but it has no models yet/)).toBeVisible();
  await expect(sheet(page).getByText(/needs to be downloaded first/)).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: /Use this model|Use / })).toHaveCount(0);
});

test("when nothing answers, it says so honestly and offers the exact fix", async ({ page }) => {
  await mockNothingRunning(page);
  await open(page);
  await sheet(page).getByRole("button", { name: "Allow and check" }).click();
  await expect(sheet(page).getByText("No AI app answered on this computer.")).toBeVisible();
  await expect(sheet(page).getByRole("checkbox", { name: "Remember my choice on this device" })).toHaveCount(0);
  // It must not claim nothing is installed: a browser cannot know that.
  await expect(sheet(page)).not.toContainText(/not installed|isn.t installed|nothing is installed/i);
  await sheet(page).getByText("Open but still not found?").click();
  const origin = new URL(page.url()).origin;
  await expect(sheet(page).getByText(`OLLAMA_ORIGINS "${origin}"`).first()).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Copy macOS command" })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Copy variable value" })).toBeVisible();
  await expect(sheet(page).getByText(/“CORS” option/)).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Help me install one" })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "Check again" })).toBeVisible();
});

test("a failing test message shows a clear problem and never shows Ready", async ({ page }) => {
  await mockOllama(page, { chatStatus: 500 });
  await open(page);
  await sheet(page).getByRole("button", { name: "Allow and check" }).click();
  await sheet(page).getByRole("button", { name: "Use llama3.2:3b" }).click();
  await expect(sheet(page).getByRole("alert")).toContainText(/Ollama didn.t respond as expected/);
  await expect(sheet(page).getByText(/Your AI is ready/)).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByTestId("home-ai-status")).not.toHaveText("Ready");
});

test("Escape closes the sheet and returns focus to the button that opened it", async ({ page }) => {
  await mockNothingRunning(page);
  await page.goto("./dashboard");
  const trigger = page.getByRole("button", { name: "Connect your AI" });
  await trigger.click();
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("focus stays inside the open sheet while tabbing", async ({ page }) => {
  await mockNothingRunning(page);
  await open(page);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  }
});

test("the sheet fits narrow screens with no sideways scrolling", async ({ page, isMobile }) => {
  test.skip(isMobile, "viewport sweep runs once on desktop");
  await mockOllama(page);
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("./dashboard");
    // Each width starts as a first-time visitor: forget the remembered consent.
    await page.evaluate(() => localStorage.removeItem("pd:careeros:ai-discovery-consent"));
    await page.reload();
    await page.getByRole("button", { name: "Connect your AI" }).click();
    await expect(sheet(page).getByRole("button", { name: "Allow and check" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `consent ${width}px`).toBeLessThanOrEqual(0);
    await sheet(page).getByRole("button", { name: "Allow and check" }).click();
    await expect(sheet(page).getByRole("button", { name: "Use llama3.2:3b" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `results ${width}px`).toBeLessThanOrEqual(0);
    const box = await sheet(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape");
  }
});

for (const theme of ["dark", "light"] as const) {
  test(`home AI panel and sheet are readable in ${theme} mode`, async ({ page, isMobile }) => {
    test.skip(isMobile, "contrast is viewport independent");
    await setTheme(page, theme);
    await mockOllama(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("./dashboard");
    let problems = await auditContrast(page, '[data-testid="home-ai-hero"]', { dark: theme === "dark" });
    expect(problems, `hero\n${report(problems)}`).toEqual([]);

    await page.getByRole("button", { name: "Connect your AI" }).click();
    problems = await auditContrast(page, ".cos-dialog", { dark: theme === "dark" });
    expect(problems, `consent\n${report(problems)}`).toEqual([]);
    await sheet(page).getByRole("button", { name: "Allow and check" }).click();
    await expect(sheet(page).getByRole("button", { name: "Use llama3.2:3b" })).toBeVisible();
    problems = await auditContrast(page, ".cos-dialog", { dark: theme === "dark" });
    expect(problems, `results\n${report(problems)}`).toEqual([]);
    await sheet(page).getByRole("button", { name: "Use llama3.2:3b" }).click();
    await expect(sheet(page).getByText(/Your AI is ready/)).toBeVisible();
    problems = await auditContrast(page, ".cos-dialog", { dark: theme === "dark" });
    expect(problems, `ready\n${report(problems)}`).toEqual([]);
    await sheet(page).getByRole("button", { name: "Done" }).click();
    problems = await auditContrast(page, '[data-testid="home-ai-strip"]', { dark: theme === "dark" });
    expect(problems, `strip\n${report(problems)}`).toEqual([]);
  });
}
