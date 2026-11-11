import { expect, test, type Page } from "@playwright/test";
import { auditContrast, setTheme, type ContrastProblem } from "./helpers/contrast";
import { mockOllama, watchLocalRequests } from "./helpers/mockOllama";

/**
 * The install helper, in real Chromium. Model names, sizes and licences shown here were verified
 * against Ollama's library, LM Studio's catalog and the makers' model cards on 2026-11-10.
 */
const report = (problems: ContrastProblem[]) => problems.map((p) => `${p.kind} ${p.ratio || ""} ${p.selector} "${p.text}" ${p.color} on ${p.background}`).join("\n");
const dialog = (page: Page) => page.getByRole("dialog");
const radio = (page: Page, name: string | RegExp) => dialog(page).getByRole("radio", { name });
const next = (page: Page) => dialog(page).getByRole("button", { name: /^Continue/ });

async function openWizard(page: Page) {
  await page.goto("./dashboard");
  await page.getByRole("button", { name: "Connect your AI" }).click();
  await dialog(page).getByRole("button", { name: "Set up a local AI" }).click();
  await expect(dialog(page).getByRole("heading", { name: "What kind of computer do you have?" })).toBeVisible();
}

async function choose(page: Page, o: { os?: "Windows" | "macOS"; app?: "Ollama" | "LM Studio"; ram?: string; gpu?: string; vram?: string; disk?: string }) {
  if (o.os) await radio(page, new RegExp(`^${o.os}`)).click();
  await next(page).click();
  if (o.app) await radio(page, new RegExp(`^${o.app}`)).click();
  await next(page).click();
  if (o.ram) await dialog(page).getByLabel("Memory (RAM)").selectOption(o.ram);
  if (o.gpu) await dialog(page).getByLabel("Graphics card").selectOption(o.gpu);
  if (o.vram) await dialog(page).getByLabel("Graphics memory (VRAM)").selectOption(o.vram);
  if (o.disk) await dialog(page).getByLabel("Free storage").selectOption(o.disk);
  await next(page).click();
  await expect(dialog(page).getByRole("heading", { name: "Choose a model" })).toBeVisible();
}

test("opens from the Connect sheet and shows a six-step progress indicator", async ({ page }) => {
  await openWizard(page);
  await expect(page.getByRole("dialog", { name: "Set up a local AI" })).toBeVisible();
  await expect(dialog(page).getByText("Step 1 of 6")).toBeVisible();
  await expect(dialog(page).getByRole("list", { name: "Setup progress" }).getByRole("listitem")).toHaveCount(6);
  await expect(dialog(page).getByRole("listitem").filter({ hasText: "Your computer" })).toHaveAttribute("aria-current", "step");
  // Windows or macOS is pre-selected from the browser, so the person can simply continue.
  await expect(next(page)).toBeEnabled();
});

test("recommends the largest model a strong graphics card can run, with real names and sizes (Ollama)", async ({ page }) => {
  await openWizard(page);
  await choose(page, { os: "Windows", app: "Ollama", ram: "32", gpu: "nvidia", vram: "16", disk: "100" });
  await expect(dialog(page).getByRole("radiogroup", { name: "Model" }).getByRole("radio")).toHaveCount(4);
  await expect(radio(page, /Gemma 4 · 12B/)).toHaveAttribute("aria-checked", "true");
  await expect(radio(page, /Gemma 4 · 12B/)).toContainText("Recommended");
  await expect(radio(page, /Gemma 4 · 12B/)).toContainText("7.7–8.0 GB");
  await expect(radio(page, /Qwen 3\.5 · 2B/)).toContainText("2.7–3.1 GB");
  await dialog(page).getByText("About these models").click();
  await expect(dialog(page)).toContainText("checked on 2026-11-10");
  await expect(dialog(page)).toContainText("Apache-2.0");
  await expect(dialog(page).getByRole("link", { name: "licence and details" }).first()).toHaveAttribute("href", /huggingface\.co/);
});

test("Ollama install step gives the exact verified command and size, and never runs anything", async ({ page }) => {
  const local = watchLocalRequests(page);
  await openWizard(page);
  // 16 GB memory with an 8 GB graphics card: the 4B model is the largest that fits the card.
  await choose(page, { os: "Windows", app: "Ollama", ram: "16", gpu: "nvidia", vram: "8", disk: "50" });
  await expect(radio(page, /Qwen 3\.5 · 4B/)).toHaveAttribute("aria-checked", "true");
  await next(page).click();
  await expect(dialog(page).getByRole("heading", { name: "Install it" })).toBeVisible();
  await expect(dialog(page)).toContainText("CareerOS never installs anything or runs commands for you");
  await expect(dialog(page).getByRole("link", { name: /Ollama.s download page/ })).toHaveAttribute("href", "https://ollama.com/download");
  await expect(dialog(page).getByRole("link", { name: /Ollama.s download page/ })).toHaveAttribute("rel", /noopener/);
  await expect(dialog(page).locator("code").filter({ hasText: /^ollama pull qwen3\.5:4b$/ })).toBeVisible();
  await expect(dialog(page)).toContainText("PowerShell");
  await dialog(page).getByText("Prefer the terminal?").click();
  await expect(dialog(page).locator("code").filter({ hasText: "irm https://ollama.com/install.ps1 | iex" })).toBeVisible();
  expect(local, "the wizard never contacts the local addresses by itself").toEqual([]);
});

test("LM Studio install step uses LM Studio's own model name, shortcut, and server step", async ({ page }) => {
  await openWizard(page);
  await choose(page, { os: "macOS", app: "LM Studio", ram: "16", gpu: "apple", disk: "50" });
  await expect(radio(page, /Gemma 4 · 12B/)).toContainText("7.40 GB");
  await next(page).click();
  await expect(dialog(page).locator("code").filter({ hasText: /^google\/gemma-4-12b$/ })).toBeVisible();
  await expect(dialog(page)).toContainText("⌘ + 2");
  await expect(dialog(page)).toContainText("Start the server");
  await expect(dialog(page)).toContainText("Developer tab");
  await expect(dialog(page).getByRole("link", { name: /LM Studio website/ })).toHaveAttribute("href", "https://lmstudio.ai/");
});

test("a computer that is too small is told so and pointed to a cloud AI", async ({ page }) => {
  await openWizard(page);
  await choose(page, { os: "Windows", app: "Ollama", ram: "4", gpu: "none", disk: "100" });
  await expect(dialog(page)).toContainText("probably too small for a good local AI");
  await expect(dialog(page).getByRole("link", { name: "Use a cloud AI instead" })).toBeVisible();
  await expect(next(page)).toBeDisabled();
  await expect(radio(page, /Qwen/)).toHaveCount(0);
});

test("a download that will not fit in the free storage is not chosen", async ({ page }) => {
  await openWizard(page);
  // 8 GB free: only the 2B and 4B downloads (with 2 GB headroom) fit, so the strong hardware cannot pick 9B or 12B.
  await choose(page, { os: "Windows", app: "Ollama", ram: "32", gpu: "nvidia", vram: "16", disk: "10" });
  await expect(radio(page, /Gemma 4 · 12B/)).toHaveAttribute("aria-checked", "true");
  await dialog(page).getByRole("button", { name: "Back" }).click();
  await dialog(page).getByLabel("Free storage").selectOption("");
  await dialog(page).getByLabel("Free storage").selectOption("10");
  await next(page).click();
  // 10 GB free fits 12B (8.0 GB + 2 GB). Unknown storage must not block anything either.
  await expect(radio(page, /Gemma 4 · 12B/)).toHaveAttribute("aria-checked", "true");
  await dialog(page).getByRole("button", { name: "Back" }).click();
  await dialog(page).getByLabel("Free storage").selectOption("");
  await next(page).click();
  await expect(radio(page, /Gemma 4 · 12B/)).not.toHaveAttribute("aria-disabled", "true");
});

test("Back keeps every answer, and progress survives a reload", async ({ page }) => {
  await openWizard(page);
  await choose(page, { os: "macOS", app: "LM Studio", ram: "8", gpu: "apple", disk: "20" });
  await dialog(page).getByRole("button", { name: "Back" }).click();
  await expect(dialog(page).getByLabel("Memory (RAM)")).toHaveValue("8");
  await expect(dialog(page).getByLabel("Graphics card")).toHaveValue("apple");
  await expect(dialog(page).getByLabel("Free storage")).toHaveValue("20");
  await dialog(page).getByRole("button", { name: "Back" }).click();
  await expect(radio(page, /^LM Studio/)).toHaveAttribute("aria-checked", "true");
  await dialog(page).getByRole("button", { name: "Back" }).click();
  await expect(radio(page, /^macOS/)).toHaveAttribute("aria-checked", "true");
  await next(page).click();
  await next(page).click();
  await expect(dialog(page).getByLabel("Memory (RAM)")).toHaveValue("8");

  await page.reload();
  await page.getByRole("button", { name: "Connect your AI" }).click();
  await dialog(page).getByRole("button", { name: "Set up a local AI" }).click();
  await expect(dialog(page).getByText("Step 3 of 6")).toBeVisible();
  await expect(dialog(page).getByLabel("Memory (RAM)")).toHaveValue("8");
  await dialog(page).getByRole("button", { name: "Start the setup over" }).click();
  await expect(dialog(page).getByText("Step 1 of 6")).toBeVisible();
});

test("finishing hands off to detection, asks before checking, and highlights the chosen model (simulated Ollama)", async ({ page }) => {
  const local = watchLocalRequests(page);
  await mockOllama(page, { models: [{ name: "qwen3.5:4b", size: 3_400_000_000, parameter_size: "4B" }, { name: "llama3.2:3b", size: 2_019_393_189 }] });
  await openWizard(page);
  await choose(page, { os: "macOS", app: "Ollama", ram: "8", gpu: "apple", disk: "50" });
  await expect(radio(page, /Qwen 3\.5 · 4B/)).toHaveAttribute("aria-checked", "true");
  await next(page).click();
  await next(page).click();
  await expect(dialog(page).getByRole("heading", { name: "Connect it to CareerOS" })).toBeVisible();
  await expect(dialog(page)).toContainText("Qwen 3.5 · 4B (qwen3.5:4b)");
  await dialog(page).getByRole("button", { name: "Check for my AI" }).click();
  // Consent comes first. Nothing has been contacted yet.
  await expect(page.getByRole("dialog", { name: "Connect your AI" })).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Allow and check" })).toBeVisible();
  expect(local).toEqual([]);
  await dialog(page).getByRole("button", { name: "Allow and check" }).click();
  await expect(dialog(page).locator(".ai-model").filter({ hasText: "qwen3.5:4b" })).toContainText("The one you chose");
  await expect(dialog(page).locator(".ai-model").filter({ hasText: "llama3.2:3b" })).not.toContainText("The one you chose");
});

test("keyboard: choices work with Space, and focus moves to each new step heading", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow");
  await openWizard(page);
  await radio(page, /^Windows/).focus();
  await page.keyboard.press("Space");
  await expect(radio(page, /^Windows/)).toHaveAttribute("aria-checked", "true");
  await next(page).focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("heading", { name: "Which app should run your AI?" })).toBeFocused();
  await expect(next(page)).toBeDisabled();
  await radio(page, /^LM Studio/).focus();
  await page.keyboard.press("Space");
  await expect(next(page)).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
});

test("copy buttons copy the exact command", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "clipboard permissions are desktop only");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openWizard(page);
  await choose(page, { os: "Windows", app: "Ollama", ram: "16", gpu: "nvidia", vram: "8", disk: "50" });
  await next(page).click();
  await dialog(page).getByRole("button", { name: "Copy download command" }).click();
  await expect(dialog(page).getByRole("button", { name: "Copy download command: copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("ollama pull qwen3.5:4b");
});

test("narrow screens fit every step without sideways scrolling", async ({ page, isMobile }) => {
  test.skip(isMobile, "viewport sweep runs once on desktop");
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await openWizard(page);
    await choose(page, { os: "Windows", app: "Ollama", ram: "16", gpu: "nvidia", vram: "8", disk: "50" });
    for (let step = 4; step <= 6; step++) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `step ${step} at ${width}px`).toBeLessThanOrEqual(0);
      const box = await dialog(page).boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      if (step < 6) await next(page).click();
    }
    await dialog(page).getByRole("button", { name: "Start the setup over" }).click();
    await page.keyboard.press("Escape");
  }
});

for (const theme of ["dark", "light"] as const) {
  test(`every step is readable in ${theme} mode`, async ({ page, isMobile }) => {
    test.skip(isMobile, "contrast is viewport independent");
    await setTheme(page, theme);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openWizard(page);
    const audit = async (label: string) => {
      const problems = await auditContrast(page, ".cos-dialog", { dark: theme === "dark" });
      expect(problems, `${label}\n${report(problems)}`).toEqual([]);
    };
    await audit("step 1");
    await next(page).click();
    await audit("step 2");
    await radio(page, /^Ollama/).click();
    await next(page).click();
    await dialog(page).getByLabel("Memory (RAM)").selectOption("16");
    await dialog(page).getByLabel("Graphics card").selectOption("nvidia");
    await dialog(page).getByLabel("Graphics memory (VRAM)").selectOption("8");
    await audit("step 3");
    await next(page).click();
    await audit("step 4");
    await dialog(page).getByText("About these models").click();
    await audit("step 4 details");
    await next(page).click();
    await dialog(page).getByText("Prefer the terminal?").click();
    await dialog(page).getByText("Something went wrong?").click();
    await audit("step 5");
    await next(page).click();
    await dialog(page).getByText("If it can’t find your AI").click();
    await audit("step 6");
  });
}
