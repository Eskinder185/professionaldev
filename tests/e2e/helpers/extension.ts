import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium, type BrowserContext, type Page, type Worker } from "@playwright/test";

export const EXT_DIST = path.resolve(process.cwd(), "apps/extension/dist");
export const SHOT_DIR = path.resolve(process.cwd(), "docs/autoapply-side-panel/screenshots");
export const STATE_KEY = "careeros:autoapply:ext-state";

export interface ExtensionHarness {
  context: BrowserContext;
  worker: Worker;
  extId: string;
  close(): Promise<void>;
}

/** Launches real Chromium with the unpacked extension loaded. */
export async function launchWithExtension(): Promise<ExtensionHarness> {
  if (!fs.existsSync(path.join(EXT_DIST, "manifest.json"))) {
    throw new Error("Extension is not built. Run `npm run ext:build` first.");
  }
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "careeros-ext-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1200, height: 800 },
    args: [`--disable-extensions-except=${EXT_DIST}`, `--load-extension=${EXT_DIST}`],
  });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 20_000 });
  const extId = new URL(worker.url()).host;
  return {
    context,
    worker,
    extId,
    async close() {
      await context.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}

export const panelUrl = (extId: string, tabId?: number) =>
  `chrome-extension://${extId}/sidepanel/index.html${tabId ? `?tab=${tabId}` : ""}`;

/** Chrome's own tab id for the first tab whose URL contains `fragment`. */
export async function chromeTabId(worker: Worker, fragment: string): Promise<number> {
  const id = await worker.evaluate(async (frag) => {
    const tabs = await (globalThis as unknown as { chrome: { tabs: { query: (q: object) => Promise<Array<{ id?: number; url?: string }>> } } }).chrome.tabs.query({});
    return tabs.find((t) => t.url?.includes(frag))?.id ?? -1;
  }, fragment);
  if (id < 0) throw new Error(`No tab with url containing ${fragment}`);
  return id;
}

export async function allChromeTabIds(worker: Worker): Promise<number[]> {
  return worker.evaluate(async () => {
    const tabs = await (globalThis as unknown as { chrome: { tabs: { query: (q: object) => Promise<Array<{ id?: number }>> } } }).chrome.tabs.query({});
    return tabs.map((t) => t.id ?? -1);
  });
}

export async function readExtensionState<T = Record<string, unknown>>(worker: Worker): Promise<T> {
  return worker.evaluate(async (key) => {
    const c = (globalThis as unknown as { chrome: { storage: { local: { get: (k: string) => Promise<Record<string, unknown>> } } } }).chrome;
    return (await c.storage.local.get(key))[key] as never;
  }, STATE_KEY);
}

export async function patchExtensionState(worker: Worker, patch: Record<string, unknown>): Promise<void> {
  await worker.evaluate(
    async ({ key, patch }) => {
      const c = (globalThis as unknown as { chrome: { storage: { local: { get: (k: string) => Promise<Record<string, unknown>>; set: (o: object) => Promise<void> } } } }).chrome;
      const cur = ((await c.storage.local.get(key))[key] as Record<string, unknown>) ?? {};
      await c.storage.local.set({ [key]: { ...cur, ...patch } });
    },
    { key: STATE_KEY, patch },
  );
}

export interface MockAI {
  baseUrl: string;
  requests: Array<{ url: string; body: string }>;
  close(): Promise<void>;
}

/** A tiny OpenAI-compatible server on loopback, standing in for LM Studio / Ollama's /v1 API. */
export async function startMockAI(reply: string): Promise<MockAI> {
  const requests: MockAI["requests"] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      requests.push({ url: req.url ?? "", body });
      res.setHeader("content-type", "application/json");
      res.setHeader("access-control-allow-origin", "*");
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: reply } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    close: () => closeServer(server),
  };
}

function closeServer(server: http.Server): Promise<void> {
  // Chrome keeps connections alive; without this, close() would wait for them indefinitely.
  server.closeAllConnections();
  return new Promise<void>((r) => server.close(() => r()));
}

export async function startStaticPage(html: string, host = "127.0.0.1"): Promise<{ url: string; close(): Promise<void> }> {
  const server = http.createServer((_req, res) => {
    res.setHeader("content-type", "text/html");
    res.end(html);
  });
  await new Promise<void>((r) => server.listen(0, host, r));
  const port = (server.address() as { port: number }).port;
  return { url: `http://${host}:${port}/`, close: () => closeServer(server) };
}

export async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}
