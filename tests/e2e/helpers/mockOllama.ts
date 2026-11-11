import type { Page, Route } from "@playwright/test";

/**
 * A SIMULATED Ollama server, answering inside real Chromium for requests to 127.0.0.1:11434.
 * Results from tests using this prove the CareerOS flow, not that a real Ollama works. They are
 * reported as "simulated provider".
 */
export interface MockOllamaOptions {
  models?: Array<{ name: string; size?: number; parameter_size?: string }>;
  /** Streamed reply pieces for a chat request. */
  reply?: string[];
  /** Make chat fail with this HTTP status. */
  chatStatus?: number;
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" };

export interface MockHandle {
  /** Every request path that reached the simulated server. */
  paths: string[];
}

export async function mockOllama(page: Page, options: MockOllamaOptions = {}): Promise<MockHandle> {
  const handle: MockHandle = { paths: [] };
  const models = options.models ?? [{ name: "llama3.2:3b", size: 2_019_393_189, parameter_size: "3.2B" }];
  const reply = options.reply ?? ["Hello! ", "I can help tailor your résumé."];
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });

  await page.route(/^http:\/\/127\.0\.0\.1:11434\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    handle.paths.push(`${request.method()} ${path}`);
    if (path === "/api/version") return json(route, { version: "0.6.0" });
    if (path === "/api/tags") return json(route, { models: models.map((m) => ({ name: m.name, model: m.name, size: m.size, details: { parameter_size: m.parameter_size ?? "3B", family: "llama", quantization_level: "Q4_K_M" } })) });
    if (path === "/api/show") return json(route, { details: { parameter_size: "3.2B", family: "llama" }, capabilities: ["completion"], model_info: {} });
    if (path === "/api/chat") {
      if (options.chatStatus) return json(route, { error: "model failed to load" }, options.chatStatus);
      const lines = [...reply.map((content) => ({ message: { role: "assistant", content }, done: false })), { done: true, eval_count: 12, eval_duration: 600_000_000 }];
      return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/x-ndjson" }, body: lines.map((l) => JSON.stringify(l)).join("\n") + "\n" });
    }
    return json(route, {}, 404);
  });
  // Nothing is listening for LM Studio: the connection is refused, as with an app that is not running.
  await page.route(/^http:\/\/127\.0\.0\.1:1234\//, (route) => route.abort("connectionrefused"));
  return handle;
}

/** Nothing is listening anywhere. */
export async function mockNothingRunning(page: Page): Promise<void> {
  await page.route(/^http:\/\/127\.0\.0\.1:(11434|1234)\//, (route) => route.abort("connectionrefused"));
}

/** Records any request to the two local addresses without answering it (to prove none were made). */
export function watchLocalRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (/^http:\/\/127\.0\.0\.1:(11434|1234)\//.test(request.url())) seen.push(request.url());
  });
  return seen;
}
