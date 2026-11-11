/**
 * AI adapters. UI code talks to the `AIAdapter` interface only; provider-specific
 * request logic lives in this file (OpenAI-compatible) and ollama.ts (Ollama native + /v1).
 *
 * Safety properties:
 * - The key is sent only in the Authorization header, only to the validated base URL.
 * - redirect: "error" — a 3xx never forwards the Authorization header elsewhere.
 * - credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store".
 * - Every request has a timeout and accepts a caller AbortSignal. Streams also have an
 *   idle timeout, so a server that stops sending mid-reply is detected.
 * - No automatic retries (a retry can be a second paid request).
 * - Error messages never include the key.
 */
import { validateEndpoint } from "./endpoint";

export type StructuredMode = "json_schema" | "prompt";

export interface ConnectionTarget {
  baseUrl: string;
  model: string;
  /** Empty string = no Authorization header. */
  apiKey: string;
  structured: StructuredMode;
  /** Capabilities reported by the server for `model`, when known (Ollama /api/show). */
  capabilities?: string[];
}

export type EndpointTarget = Pick<ConnectionTarget, "baseUrl" | "apiKey">;

export interface ChatMessage {
  role: "system" | "user";
  content: string;
  /** Raw base64 image data (no data: prefix) for vision-capable models. Local use only. */
  images?: string[];
}

export interface JsonSchemaFormat {
  name: string;
  schema: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  sizeBytes?: number;
  parameterSize?: string;
  quantization?: string;
  family?: string;
  contextLength?: number;
  capabilities?: string[];
}

export interface ChatMetrics {
  /** Request start → first visible text (streaming only). */
  firstTokenMs?: number;
  totalMs: number;
  outputTokens?: number;
  tokensPerSecond?: number;
}

export interface ChatResult {
  text: string;
  metrics: ChatMetrics;
}

export interface ChatOptions {
  format?: JsonSchemaFormat;
  signal?: AbortSignal;
  /** Time allowed until the first byte arrives. */
  timeoutMs?: number;
  /** Stream the reply; `onToken` receives each piece of visible text. */
  stream?: boolean;
  onToken?: (piece: string) => void;
}

export interface ProbeResult {
  latencyMs: number;
  version?: string;
}

export interface AIAdapter {
  readonly kind: "ollama" | "openai" | "gemini" | "anthropic";
  /** Cheap reachability check (no generation). */
  probe(target: EndpointTarget, signal?: AbortSignal): Promise<ProbeResult>;
  /** Installed / available models, or null when the server doesn't offer a list. */
  listModels(target: EndpointTarget, signal?: AbortSignal): Promise<ModelInfo[] | null>;
  /** Details for one model (capabilities, context length), or null if unsupported. */
  describeModel(target: EndpointTarget, model: string, signal?: AbortSignal): Promise<ModelInfo | null>;
  chat(target: ConnectionTarget, messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
}

export const MODELS_TIMEOUT_MS = 15_000;
export const CHAT_TIMEOUT_MS = 180_000;
export const STREAM_IDLE_MS = 60_000;

export type AIErrorKind =
  | "invalid_endpoint"
  | "auth"
  | "forbidden"
  | "model_not_found"
  | "not_found"
  | "quota"
  | "rate_limit"
  | "bad_request"
  | "server"
  | "malformed"
  | "timeout"
  | "cancelled"
  | "network"
  | "redirect";

export class AIError extends Error {
  readonly kind: AIErrorKind;
  readonly status?: number;
  constructor(kind: AIErrorKind, message: string, status?: number) {
    super(message);
    this.name = "AIError";
    this.kind = kind;
    this.status = status;
  }
}

export type Fetch = typeof fetch;

export const NETWORK_ERROR_MESSAGE =
  "Couldn’t reach the server. It may not be running, the address may be wrong, or the browser blocked the request (CORS or local network permission). A browser can’t tell these apart.";

/** Combine the caller's signal with a resettable timeout, tracking whether it fired. */
export function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout>;
  const arm = (t: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, t);
  };
  arm(ms);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    rearm: arm,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

function headers(apiKey: string, json: boolean): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (json) h["Content-Type"] = "application/json";
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  return h;
}

function providerMessage(body: unknown): { message?: string; code?: string; type?: string } {
  if (!body || typeof body !== "object") return {};
  const err = (body as { error?: unknown }).error;
  if (typeof err === "string") return { message: err };
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      message: typeof e.message === "string" ? e.message : undefined,
      code: typeof e.code === "string" ? e.code : undefined,
      type: typeof e.type === "string" ? e.type : undefined,
    };
  }
  return {};
}

/** Keep provider text short and strip anything that looks like a bearer token. */
function clean(text: string | undefined, apiKey: string): string {
  if (!text) return "";
  let t = text.slice(0, 240);
  if (apiKey) t = t.split(apiKey).join("[key]");
  return t.replace(/\b(sk-[A-Za-z0-9_-]{6})[A-Za-z0-9_-]+/g, "$1…");
}

export function errorForStatus(status: number, body: unknown, apiKey: string, model?: string): AIError {
  const { message, code, type } = providerMessage(body);
  const detail = clean(message, apiKey);
  const suffix = detail ? ` Server said: “${detail}”` : "";
  if (status === 401) return new AIError("auth", "The server rejected the API key. Check that it’s correct and active." + suffix, status);
  if (status === 403) {
    return new AIError("forbidden", "The server refused the request. A key may lack access to this model, or a local server may not allow requests from this website (CORS)." + suffix, status);
  }
  if (status === 404) {
    const looksLikeModel = code === "model_not_found" || /model/i.test(message ?? "");
    return looksLikeModel
      ? new AIError("model_not_found", `The server doesn’t have a model named “${model ?? ""}”. Check the exact name, or pick one from the list.` + suffix, status)
      : new AIError("not_found", "Nothing answered at that path. Check the server address." + suffix, status);
  }
  if (status === 429) {
    if (code === "insufficient_quota" || type === "insufficient_quota") {
      return new AIError("quota", "Your provider account is out of credit or over its spending limit." + suffix, status);
    }
    return new AIError("rate_limit", "The provider is rate-limiting requests. Wait a minute and try again." + suffix, status);
  }
  if (status === 400 || status === 422) return new AIError("bad_request", "The server couldn’t process the request." + suffix, status);
  if (status >= 500) return new AIError("server", `The server had an error (HTTP ${status}). Try again later.` + suffix, status);
  return new AIError("server", `Unexpected response (HTTP ${status}).` + suffix, status);
}

interface RequestInit2 {
  method: "GET" | "POST";
  apiKey: string;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs: number;
  model?: string;
}

async function open(fetchImpl: Fetch, url: string, init: RequestInit2, t: ReturnType<typeof withTimeout>): Promise<Response> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: init.method,
      headers: headers(init.apiKey, init.body !== undefined),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: t.signal,
      redirect: "error",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      mode: "cors",
    });
  } catch (e) {
    throw transportError(e, init, t);
  }
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    throw new AIError("redirect", "The server tried to redirect. Redirects are blocked so your key can’t be forwarded elsewhere. Use the final address.");
  }
  if (!res.ok) {
    let body: unknown;
    try {
      const text = await res.text();
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    throw errorForStatus(res.status, body, init.apiKey, init.model);
  }
  return res;
}

function transportError(e: unknown, init: RequestInit2, t: ReturnType<typeof withTimeout>): AIError {
  if (e instanceof AIError) return e;
  if (t.timedOut()) return new AIError("timeout", `No response after ${Math.round(init.timeoutMs / 1000)} seconds. The server may be busy or the model still loading.`);
  if (init.signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) return new AIError("cancelled", "Request cancelled.");
  return new AIError("network", NETWORK_ERROR_MESSAGE);
}

/** One JSON request/response. */
export async function requestJson(fetchImpl: Fetch, url: string, init: RequestInit2): Promise<unknown> {
  const t = withTimeout(init.signal, init.timeoutMs);
  try {
    const res = await open(fetchImpl, url, init, t);
    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      throw transportError(e, init, t);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new AIError("malformed", "The server replied, but not with JSON. Is this the right kind of server?");
    }
  } finally {
    t.done();
  }
}

/**
 * Streamed request. Calls `onLine` for every non-empty line of the body.
 * Timeout: `init.timeoutMs` until the response starts, then STREAM_IDLE_MS between chunks.
 */
export async function requestLines(fetchImpl: Fetch, url: string, init: RequestInit2, onLine: (line: string) => void, idleMs = STREAM_IDLE_MS): Promise<void> {
  const t = withTimeout(init.signal, init.timeoutMs);
  try {
    const res = await open(fetchImpl, url, init, t);
    if (!res.body) throw new AIError("malformed", "The server didn’t stream a reply.");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    t.rearm(idleMs);
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (e) {
        throw t.timedOut() ? new AIError("timeout", `The reply stopped for more than ${Math.round(idleMs / 1000)} seconds.`) : transportError(e, init, t);
      }
      if (chunk.done) break;
      t.rearm(idleMs);
      buf += decoder.decode(chunk.value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, "");
        buf = buf.slice(nl + 1);
        if (line.trim()) onLine(line);
      }
    }
    buf += decoder.decode();
    if (buf.trim()) onLine(buf.trim());
  } finally {
    t.done();
  }
}

export function checkedBase(baseUrl: string): string {
  const v = validateEndpoint(baseUrl);
  if (!v.ok) throw new AIError("invalid_endpoint", v.error);
  return v.baseUrl;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
export { now as clock };

export function buildChatBody(target: ConnectionTarget, messages: ChatMessage[], format?: JsonSchemaFormat, stream = false) {
  // OpenAI-compatible servers take images as content parts.
  const wire = messages.map((m) =>
    m.images?.length
      ? { role: m.role, content: [{ type: "text", text: m.content }, ...m.images.map((data) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${data}` } }))] }
      : { role: m.role, content: m.content },
  );
  const body: Record<string, unknown> = { model: target.model, messages: wire, stream };
  if (format && target.structured === "json_schema") {
    body.response_format = { type: "json_schema", json_schema: { name: format.name, schema: format.schema, strict: true } };
  }
  return body;
}

export function contentOf(body: unknown): string {
  const choice = (body as { choices?: unknown }).choices;
  const first = Array.isArray(choice) ? choice[0] : undefined;
  const message = first && typeof first === "object" ? (first as { message?: unknown }).message : undefined;
  const content = message && typeof message === "object" ? (message as { content?: unknown }).content : undefined;
  if (typeof content !== "string") {
    const refusal = message && typeof message === "object" ? (message as { refusal?: unknown }).refusal : undefined;
    if (typeof refusal === "string" && refusal) throw new AIError("malformed", `The model declined: ${refusal.slice(0, 200)}`);
    throw new AIError("malformed", "The server replied without any message text.");
  }
  return content;
}

export function createOpenAICompatibleAdapter(fetchImpl: Fetch = (...a) => fetch(...a)): AIAdapter {
  const listModels: AIAdapter["listModels"] = async (target, signal) => {
    const base = checkedBase(target.baseUrl);
    let body: unknown;
    try {
      body = await requestJson(fetchImpl, `${base}/models`, { method: "GET", apiKey: target.apiKey, signal, timeoutMs: MODELS_TIMEOUT_MS });
    } catch (e) {
      if (e instanceof AIError && (e.kind === "not_found" || (e.kind === "server" && e.status === 405))) return null;
      throw e;
    }
    const data = (body as { data?: unknown }).data;
    if (!Array.isArray(data)) throw new AIError("malformed", "The model list wasn’t in the expected format.");
    const ids = data
      .map((m) => (m && typeof m === "object" && typeof (m as { id?: unknown }).id === "string" ? (m as { id: string }).id : null))
      .filter((id): id is string => !!id);
    return [...new Set(ids)].sort((a, b) => a.localeCompare(b)).map((id) => ({ id }));
  };

  return {
    kind: "openai",
    async probe(target, signal) {
      const start = now();
      await listModels(target, signal);
      return { latencyMs: Math.round(now() - start) };
    },
    listModels,
    async describeModel() {
      return null;
    },
    async chat(target, messages, options = {}) {
      const base = checkedBase(target.baseUrl);
      if (!target.model.trim()) throw new AIError("bad_request", "Choose a model first.");
      const start = now();
      const init: RequestInit2 = {
        method: "POST",
        apiKey: target.apiKey,
        body: buildChatBody(target, messages, options.format, !!options.stream),
        signal: options.signal,
        timeoutMs: options.timeoutMs ?? CHAT_TIMEOUT_MS,
        model: target.model,
      };
      if (!options.stream) {
        const text = contentOf(await requestJson(fetchImpl, `${base}/chat/completions`, init));
        return { text, metrics: { totalMs: Math.round(now() - start) } };
      }
      let text = "";
      let firstTokenMs: number | undefined;
      let outputTokens: number | undefined;
      let sawData = false;
      await requestLines(fetchImpl, `${base}/chat/completions`, init, (line) => {
        if (!line.startsWith("data:")) return;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        sawData = true;
        let json: unknown;
        try {
          json = JSON.parse(data);
        } catch {
          throw new AIError("malformed", "The server sent a stream CareerOS couldn’t read.");
        }
        const err = (json as { error?: unknown }).error;
        if (err) throw errorForStatus(500, json, target.apiKey, target.model);
        const choice = (json as { choices?: { delta?: { content?: unknown } }[] }).choices?.[0];
        const piece = choice?.delta?.content;
        if (typeof piece === "string" && piece) {
          firstTokenMs ??= Math.round(now() - start);
          text += piece;
          options.onToken?.(piece);
        }
        const usage = (json as { usage?: { completion_tokens?: unknown } }).usage;
        if (typeof usage?.completion_tokens === "number") outputTokens = usage.completion_tokens;
      });
      if (!sawData) throw new AIError("malformed", "The server didn’t send a streamed reply.");
      const totalMs = Math.round(now() - start);
      return { text, metrics: { firstTokenMs, totalMs, outputTokens } };
    },
  };
}
