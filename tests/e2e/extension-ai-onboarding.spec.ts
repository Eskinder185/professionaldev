import { expect, test, type Page, type Route } from "@playwright/test";
import { auditContrast } from "./helpers/contrast";
import { launchWithExtension, noHorizontalScroll, panelUrl, readExtensionState, type ExtensionHarness } from "./helpers/extension";

/**
 * One-click AI setup in the real extension. The local AI apps are SIMULATED inside Chromium (the
 * panel's own requests to the two standard loopback addresses are answered by this file), so these
 * results prove CareerOS's behaviour, not that a real Ollama or LM Studio works. Real-provider
 * verification is reported separately.
 */

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" };
interface Model {
  name: string;
  params: string;
  size?: number;
}
interface Services {
  ollama?: { models: Model[]; chatStatus?: number };
  lmstudio?: { models: string[]; chatStatus?: number };
}

const OLLAMA_TRIO: Model[] = [
  { name: "qwen3:14b", params: "14B", size: 9_000_000_000 },
  { name: "llama3.2:3b", params: "3.2B", size: 2_000_000_000 },
  { name: "tinyllama:1.1b", params: "1.1B", size: 640_000_000 },
];

test.describe.configure({ mode: "serial" });

test.describe("Connect Your AI (real Chromium, simulated local apps)", () => {
  test.skip(({ isMobile }) => isMobile, "Extension tests run once, on desktop Chromium");

  let h: ExtensionHarness;
  let panel: Page;
  let seen: string[] = [];
  let chats = 0;

  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });

  const serve = async (services: Services) => {
    await panel.unrouteAll({ behavior: "ignoreErrors" });
    await panel.route(/^http:\/\/127\.0\.0\.1:11434\//, async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      if (!services.ollama) return route.abort("connectionrefused");
      seen.push(`ollama ${path}`);
      if (path === "/api/version") return json(route, { version: "0.6.0" });
      if (path === "/api/tags") return json(route, { models: services.ollama.models.map((m) => ({ name: m.name, model: m.name, size: m.size, details: { parameter_size: m.params, family: "x" } })) });
      if (path === "/api/show") return json(route, { details: { parameter_size: "3B" }, capabilities: ["completion"], model_info: {} });
      if (path === "/api/chat") {
        chats += 1;
        if (services.ollama.chatStatus) return json(route, { error: "boom" }, services.ollama.chatStatus);
        return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ message: { role: "assistant", content: "ready" }, done: true }) });
      }
      return json(route, {}, 404);
    });
    await panel.route(/^http:\/\/127\.0\.0\.1:1234\//, async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      if (!services.lmstudio) return route.abort("connectionrefused");
      seen.push(`lmstudio ${path}`);
      if (path === "/v1/models") return json(route, { data: services.lmstudio.models.map((id) => ({ id })) });
      if (path === "/v1/chat/completions") {
        chats += 1;
        if (services.lmstudio.chatStatus) return json(route, { error: { message: "boom" } }, services.lmstudio.chatStatus);
        return json(route, { choices: [{ message: { role: "assistant", content: "ready" } }] });
      }
      return json(route, {}, 404);
    });
  };

  const reset = async (services: Services = {}) => {
    await h.worker.evaluate(async () => {
      const c = (globalThis as unknown as { chrome: { storage: { local: { remove(k: string[]): Promise<void>; get(k: string): Promise<Record<string, unknown>>; set(o: object): Promise<void> } } } }).chrome;
      await c.storage.local.remove(["careeros:ai-discovery-consent", "careeros:ai-guide"]);
      const key = "careeros:autoapply:ext-state";
      const cur = ((await c.storage.local.get(key))[key] as Record<string, unknown>) ?? {};
      await c.storage.local.set({ [key]: { ...cur, aiConnection: null } });
    });
    seen = [];
    chats = 0;
    await serve(services);
    await panel.setViewportSize({ width: 390, height: 1000 });
    await panel.goto(panelUrl(h.extId));
    await panel.getByTestId("tab-ai").click();
  };

  const allow = async () => {
    await panel.getByTestId("ai-find").click();
    await panel.getByTestId("ai-allow").click();
  };

  test.beforeAll(async () => {
    h = await launchWithExtension();
    panel = await h.context.newPage();
  });
  test.afterAll(async () => {
    await h?.close();
  });

  test("first-time user sees two simple choices and no technical fields", async () => {
    await reset();
    await expect(panel.getByRole("heading", { name: "Connect Your AI" })).toBeVisible();
    await expect(panel.getByText("Let AI help you find jobs, tailor your résumé, and prepare applications.")).toBeVisible();
    await expect(panel.getByText("Use AI on this computer")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Find My AI" })).toBeVisible();
    await expect(panel.getByText("Use Cloud AI").first()).toBeVisible();
    await expect(panel.getByRole("button", { name: "Choose Cloud AI" })).toBeVisible();
    // Technical controls exist but are collapsed.
    await expect(panel.getByTestId("ai-settings")).toBeHidden();
    await expect(panel.getByRole("textbox", { name: "Endpoint" })).toBeHidden();
    await expect(panel.getByLabel("Provider")).toBeHidden();
    expect(seen).toEqual([]);
  });

  test("nothing is contacted until the person agrees; declining checks nothing", async () => {
    await reset({ ollama: { models: OLLAMA_TRIO } });
    await panel.getByTestId("ai-find").click();
    await expect(panel.getByTestId("ai-consent-step")).toBeVisible();
    await expect(panel.getByTestId("ai-consent-step")).toContainText("Nothing is sent anywhere else");
    expect(seen).toEqual([]);
    await panel.getByTestId("ai-decline").click();
    await expect(panel.getByTestId("ai-notice")).toContainText("Nothing was checked");
    expect(seen).toEqual([]);
    const consent = await h.worker.evaluate(async () => ((await (globalThis as unknown as { chrome: { storage: { local: { get(k: string): Promise<Record<string, unknown>> } } } }).chrome.storage.local.get("careeros:ai-discovery-consent"))["careeros:ai-discovery-consent"]));
    expect(consent).toBe("declined");
  });

  test("Ollama running with several models: ranked choices, then a real test before 'ready'", async () => {
    await reset({ ollama: { models: OLLAMA_TRIO } });
    await allow();
    const found = panel.getByTestId("ai-found");
    await expect(found).toBeVisible();
    await expect(panel.getByTestId("ai-service-ollama")).toContainText("Ollama — 3 models available");
    await expect(panel.getByTestId("ai-recommended")).toContainText("qwen3:14b");
    await expect(panel.getByTestId("ai-group-recommended")).toContainText("qwen3:14b");
    await expect(panel.getByTestId("ai-group-fastest")).toContainText("llama3.2:3b");
    await expect(panel.getByTestId("ai-group-others")).toContainText("tinyllama:1.1b");
    await expect(panel.getByTestId("ai-group-others")).toContainText(/too small/i);
    expect(chats).toBe(0);
    // The saved state says disconnected until a real reply comes back.
    expect(((await readExtensionState<{ aiConnection: unknown }>(h.worker)).aiConnection) ?? null).toBeNull();

    await panel.getByTestId("ai-connect").click();
    await expect(panel.getByTestId("ai-ready")).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Your AI is ready" })).toBeVisible();
    await expect(panel.getByTestId("ai-facts")).toContainText("Ollama");
    await expect(panel.getByTestId("ai-model")).toHaveText("qwen3:14b");
    await expect(panel.getByTestId("ai-facts")).toContainText("On this computer");
    await expect(panel.getByTestId("ai-status")).toContainText("Answered a test");
    expect(chats).toBeGreaterThan(0);
    const saved = (await readExtensionState<{ aiConnection: { connected: boolean; model: string; provider: string } }>(h.worker)).aiConnection;
    expect(saved).toMatchObject({ connected: true, model: "qwen3:14b", provider: "ollama" });
    // Only the two standard addresses were ever contacted.
    expect(seen.every((s) => s.startsWith("ollama ") || s.startsWith("lmstudio "))).toBe(true);
  });

  test("connection persists across reopening, and is verified rather than assumed", async () => {
    await panel.reload();
    await panel.getByTestId("tab-ai").click();
    await expect(panel.getByTestId("ai-ready")).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Your AI is available" })).toBeVisible();
    await expect(panel.getByTestId("ai-status")).toContainText("Not tested this session");
    const before = chats;
    await panel.getByTestId("ai-test-again").click();
    await expect(panel.getByRole("heading", { name: "Your AI is ready" })).toBeVisible();
    expect(chats).toBeGreaterThan(before);
    await expect(panel.getByTestId("header-ai")).toContainText("AI Ready");
    await expect(panel.getByTestId("header-ai")).toHaveAttribute("title", /qwen3:14b/);
  });

  test("a saved connection whose service stopped shows Reconnect, never 'ready'", async () => {
    await serve({});
    await panel.reload();
    await panel.getByTestId("tab-ai").click();
    await expect(panel.getByTestId("ai-reconnect")).toBeVisible();
    await expect(panel.getByTestId("ai-problem")).toContainText(/couldn.t reach your AI/i);
    await expect(panel.getByRole("heading", { name: /ready/i })).toHaveCount(0);
    const cloudBefore = seen.length;
    await panel.getByTestId("ai-reconnect-btn").click();
    // Already agreed earlier, so it searches straight away and finds nothing.
    await expect(panel.getByTestId("ai-none")).toBeVisible();
    expect(seen.length).toBe(cloudBefore);
  });

  test("a removed model is reported plainly", async () => {
    await serve({ ollama: { models: [{ name: "llama3.2:3b", params: "3.2B" }] } });
    await panel.reload();
    await panel.getByTestId("tab-ai").click();
    await expect(panel.getByTestId("ai-problem")).toContainText("isn’t installed");
  });

  test("LM Studio only", async () => {
    await reset({ lmstudio: { models: ["google/gemma-3-12b"] } });
    await allow();
    await expect(panel.getByTestId("ai-service-lmstudio")).toContainText("LM Studio — 1 model available");
    await expect(panel.getByTestId("ai-service-ollama")).toHaveCount(0);
    await panel.getByTestId("ai-connect").click();
    await expect(panel.getByRole("heading", { name: "Your AI is ready" })).toBeVisible();
    await expect(panel.getByTestId("ai-facts")).toContainText("LM Studio");
  });

  test("both running: both are offered", async () => {
    await reset({ ollama: { models: OLLAMA_TRIO }, lmstudio: { models: ["google/gemma-3-12b"] } });
    await allow();
    await expect(panel.getByTestId("ai-service-ollama")).toBeVisible();
    await expect(panel.getByTestId("ai-service-lmstudio")).toBeVisible();
  });

  test("a model that fails its test is explained in plain words and nothing is saved as connected", async () => {
    await reset({ ollama: { models: OLLAMA_TRIO, chatStatus: 500 } });
    await allow();
    await panel.getByTestId("ai-connect").click();
    await expect(panel.getByTestId("ai-error")).toContainText(/ran into a problem|Something went wrong/);
    await expect(panel.getByTestId("ai-error")).not.toContainText(/stack|TypeError|500|boom/i);
    await expect(panel.getByTestId("ai-ready")).toHaveCount(0);
    const state = (await readExtensionState<{ aiConnection: { connected?: boolean } | null }>(h.worker)).aiConnection;
    expect(state?.connected ?? false).toBe(false);
  });

  test("running without models: says so and offers setup", async () => {
    await reset({ ollama: { models: [] } });
    await allow();
    await expect(panel.getByTestId("ai-none")).toContainText("no models yet");
  });

  test("nothing running: guided setup continues where it was, then finds the service", async () => {
    await reset({});
    await allow();
    await expect(panel.getByRole("heading", { name: "No running AI service was found." })).toBeVisible();
    await expect(panel.getByTestId("ai-setup-free")).toBeVisible();
    await expect(panel.getByTestId("ai-check-again")).toBeVisible();
    await expect(panel.getByTestId("ai-use-cloud-instead")).toBeVisible();
    await panel.getByTestId("ai-setup-free").click();
    const guide = panel.getByTestId("ai-guide");
    await expect(guide).toContainText("ollama.com/download");
    await expect(guide.getByRole("link", { name: /ollama\.com\/download/ })).toHaveAttribute("href", "https://ollama.com/download");
    await panel.getByTestId("ai-guide-next").click();
    await panel.getByTestId("ai-guide-next").click();
    await expect(panel.getByTestId("ai-command")).toContainText("ollama pull ");
    // The person starts the app themselves; CareerOS only checks again, from the same step.
    await panel.getByTestId("ai-guide-check").click();
    await expect(panel.getByTestId("ai-still-missing")).toContainText("step 3");
    await expect(panel.getByTestId("ai-command")).toBeVisible();
    await serve({ ollama: { models: OLLAMA_TRIO } });
    await panel.getByTestId("ai-guide-check").click();
    await expect(panel.getByTestId("ai-found")).toBeVisible();
  });

  test("LM Studio and macOS guidance", async () => {
    await reset({});
    await allow();
    await panel.getByTestId("ai-setup-free").click();
    await panel.getByRole("button", { name: "macOS" }).click();
    await panel.getByRole("button", { name: "LM Studio" }).click();
    await expect(panel.getByTestId("ai-guide")).toContainText("Download LM Studio for macOS");
    await expect(panel.getByTestId("ai-guide").getByRole("link", { name: /lmstudio\.ai/ })).toHaveAttribute("href", "https://lmstudio.ai/");
  });

  test("cloud: four providers, all 'Secure setup required', and nothing is contacted", async () => {
    await reset({ ollama: { models: OLLAMA_TRIO } });
    await panel.getByTestId("ai-choose-cloud").click();
    for (const id of ["openai", "gemini", "anthropic", "custom_cloud"]) await expect(panel.getByTestId(`cloud-${id}`)).toContainText("Secure setup required");
    await expect(panel.getByRole("textbox", { name: /api key/i })).toHaveCount(0);
    expect(seen).toEqual([]);
  });

  test("permission can be taken back, and the person is asked again", async () => {
    await reset({ ollama: { models: OLLAMA_TRIO } });
    await allow();
    await expect(panel.getByTestId("ai-found")).toBeVisible();
    await panel.getByTestId("ai-advanced").locator("summary").click();
    await expect(panel.getByTestId("ai-consent-state")).toHaveText("allowed");
    await panel.getByTestId("ai-revoke").click();
    await expect(panel.getByTestId("ai-consent-state")).toHaveText("not asked yet");
    await panel.reload();
    await panel.getByTestId("tab-ai").click();
    seen = [];
    await panel.getByTestId("ai-find").click();
    await expect(panel.getByTestId("ai-consent-step")).toBeVisible();
    expect(seen).toEqual([]);
  });

  test("Page tab: AI help is offered only with a connection; shortcuts open the review step", async () => {
    await reset({});
    await panel.getByTestId("tab-page").click();
    await expect(panel.getByTestId("header-ai")).toContainText("Connect AI");
  });

  test("keyboard: Find My AI works from the keyboard and focus lands on the next screen", async () => {
    await reset({ ollama: { models: OLLAMA_TRIO } });
    await panel.getByTestId("ai-find").focus();
    await panel.keyboard.press("Enter");
    await expect(panel.getByRole("heading", { name: "Look for AI on this computer?" })).toBeFocused();
    await panel.getByTestId("ai-allow").focus();
    await panel.keyboard.press("Enter");
    await expect(panel.getByRole("heading", { name: "AI found on your computer" })).toBeFocused();
    // The models form one radio group: arrow keys choose, Tab leaves for Connect & Test.
    const radios = panel.getByRole("radio");
    await radios.first().focus();
    await expect(radios.first()).toBeChecked();
    await panel.keyboard.press("ArrowDown");
    await expect(radios.nth(1)).toBeChecked();
    await expect(radios.nth(1)).toBeFocused();
    await panel.keyboard.press("Tab");
    await expect(panel.getByTestId("ai-connect")).toBeFocused();
  });

  test("narrow panel and both themes: no horizontal scroll, readable contrast", async () => {
    await reset({ ollama: { models: OLLAMA_TRIO } });
    await panel.setViewportSize({ width: 320, height: 1000 });
    await allow();
    await expect(panel.getByTestId("ai-found")).toBeVisible();
    expect(await noHorizontalScroll(panel)).toBe(true);
    for (const scheme of ["light", "dark"] as const) {
      await panel.emulateMedia({ colorScheme: scheme });
      // Let the theme change start its colour transitions, then wait for them to finish before measuring.
      await panel.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));
      await panel.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
      const problems = await auditContrast(panel, ".connect-wrap", { dark: scheme === "dark" });
      expect(problems, `found screen, ${scheme}: ${JSON.stringify(problems.slice(0, 3))}`).toEqual([]);
    }
    await panel.getByTestId("ai-connect").click();
    await expect(panel.getByTestId("ai-ready")).toBeVisible();
    for (const scheme of ["light", "dark"] as const) {
      await panel.emulateMedia({ colorScheme: scheme });
      // Let the theme change start its colour transitions, then wait for them to finish before measuring.
      await panel.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));
      await panel.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
      const problems = await auditContrast(panel, ".connect-wrap", { dark: scheme === "dark" });
      expect(problems, `ready screen, ${scheme}: ${JSON.stringify(problems.slice(0, 3))}`).toEqual([]);
    }
  });
});
