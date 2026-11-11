/**
 * Anthropic Messages API adapter (https://api.anthropic.com/v1).
 *
 * Wire protocol differences from OpenAI:
 * - Authentication uses `x-api-key` and `anthropic-version: 2023-06-01` headers.
 * - Model discovery uses `GET {base}/models` returning `{ data: [{ id: "claude-...", ... }] }`.
 * - Chat generation uses `POST {base}/messages` with `max_tokens`, top-level `system`, and `messages`.
 * - Non-streaming responses return `{ content: [{ type: "text", text: "..." }], usage: { output_tokens } }`.
 * - Streaming responses use SSE events with `type: "content_block_delta"` and `delta: { type: "text_delta", text: "..." }`.
 */
import {
  AIError,
  CHAT_TIMEOUT_MS,
  MODELS_TIMEOUT_MS,
  STREAM_IDLE_MS,
  checkedBase,
  clock,
  errorForStatus,
  withTimeout,
  type AIAdapter,
  type ChatMessage,
  type ConnectionTarget,
  type EndpointTarget,
  type Fetch,
  type ModelInfo,
} from "./client";

function anthropicHeaders(apiKey: string, json: boolean): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (json) h["Content-Type"] = "application/json";
  if (apiKey) h["x-api-key"] = apiKey;
  return h;
}

export function buildAnthropicBody(
  model: string,
  messages: ChatMessage[],
  stream = false,
): Record<string, unknown> {
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n")
    .trim();

  const userMessages = messages.filter((m) => m.role !== "system");
  const normalizedMessages = (userMessages.length ? userMessages : messages).map((m) => ({
    role: "user",
    content: m.content,
  }));

  const body: Record<string, unknown> = {
    model,
    max_tokens: 2048,
    messages: normalizedMessages,
    stream,
  };
  if (systemText) {
    body.system = systemText;
  }
  return body;
}

export function extractAnthropicText(body: unknown): { text: string; outputTokens?: number } {
  if (!body || typeof body !== "object") {
    throw new AIError("malformed", "Anthropic replied with an empty or invalid response.");
  }
  const content = (body as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new AIError("malformed", "Anthropic response did not include a content array.");
  }
  const text = content
    .map((block) =>
      block &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
        ? (block as { text: string }).text
        : "",
    )
    .join("");
  if (!text) {
    throw new AIError("malformed", "Anthropic replied without any text blocks.");
  }
  const usage = (body as { usage?: { output_tokens?: unknown } }).usage;
  const outputTokens =
    typeof usage?.output_tokens === "number" ? usage.output_tokens : undefined;
  return { text, outputTokens };
}

async function anthropicRequestJson(
  fetchImpl: Fetch,
  url: string,
  method: "GET" | "POST",
  apiKey: string,
  body: unknown | undefined,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  model?: string,
): Promise<unknown> {
  const t = withTimeout(signal, timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method,
        headers: anthropicHeaders(apiKey, body !== undefined),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: t.signal,
        redirect: "error",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        mode: "cors",
      });
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (t.timedOut()) {
        throw new AIError(
          "timeout",
          `No response after ${Math.round(timeoutMs / 1000)} seconds from Anthropic.`,
        );
      }
      if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
        throw new AIError("cancelled", "Request cancelled.");
      }
      throw new AIError(
        "network",
        "Couldn’t reach the Anthropic endpoint. Direct browser requests to api.anthropic.com may require a local companion or CORS-enabled gateway.",
      );
    }

    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      throw new AIError("redirect", "The server tried to redirect. Redirects are blocked for safety.");
    }
    if (!res.ok) {
      let errBody: unknown = null;
      try {
        const txt = await res.text();
        errBody = txt ? JSON.parse(txt) : null;
      } catch {
        errBody = null;
      }
      throw errorForStatus(res.status, errBody, apiKey, model);
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new AIError("malformed", "Anthropic replied, but not with valid JSON.");
    }
  } finally {
    t.done();
  }
}

export function createAnthropicAdapter(fetchImpl: Fetch = (...a) => fetch(...a)): AIAdapter {
  const listModels = async (
    target: EndpointTarget,
    signal?: AbortSignal,
  ): Promise<ModelInfo[] | null> => {
    const base = checkedBase(target.baseUrl);
    try {
      const body = await anthropicRequestJson(
        fetchImpl,
        `${base}/models`,
        "GET",
        target.apiKey,
        undefined,
        signal,
        MODELS_TIMEOUT_MS,
      );
      const data = (body as { data?: unknown }).data;
      if (!Array.isArray(data)) return null;
      const out: ModelInfo[] = [];
      for (const item of data) {
        if (!item || typeof item !== "object") continue;
        const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id : "";
        if (!id) continue;
        out.push({
          id,
          family: "claude",
          capabilities: ["chat", "json_schema", "tools"],
        });
      }
      return out.sort((a, b) => a.id.localeCompare(b.id));
    } catch (e) {
      if (e instanceof AIError && (e.kind === "not_found" || e.status === 405)) {
        return null;
      }
      throw e;
    }
  };

  return {
    kind: "anthropic",
    async probe(target, signal) {
      const start = clock();
      await listModels(target, signal);
      return { latencyMs: Math.round(clock() - start) };
    },
    listModels,
    async describeModel(_target, model) {
      return {
        id: model,
        family: "claude",
        capabilities: ["chat", "json_schema", "tools"],
      };
    },
    async chat(target: ConnectionTarget, messages: ChatMessage[], options = {}) {
      const base = checkedBase(target.baseUrl);
      const model = target.model.trim();
      if (!model) throw new AIError("bad_request", "Choose an Anthropic model first.");
      const start = clock();
      const timeoutMs = options.timeoutMs ?? CHAT_TIMEOUT_MS;
      const payload = buildAnthropicBody(model, messages, !!options.stream);

      if (!options.stream) {
        const res = await anthropicRequestJson(
          fetchImpl,
          `${base}/messages`,
          "POST",
          target.apiKey,
          payload,
          options.signal,
          timeoutMs,
          model,
        );
        const { text, outputTokens } = extractAnthropicText(res);
        return {
          text,
          metrics: { totalMs: Math.round(clock() - start), outputTokens },
        };
      }

      const t = withTimeout(options.signal, timeoutMs);
      try {
        const res = await fetchImpl(`${base}/messages`, {
          method: "POST",
          headers: anthropicHeaders(target.apiKey, true),
          body: JSON.stringify(payload),
          signal: t.signal,
          redirect: "error",
          credentials: "omit",
          referrerPolicy: "no-referrer",
          cache: "no-store",
          mode: "cors",
        });
        if (!res.ok) {
          let errBody: unknown = null;
          try {
            errBody = JSON.parse(await res.text());
          } catch {
            errBody = null;
          }
          throw errorForStatus(res.status, errBody, target.apiKey, model);
        }
        if (!res.body) throw new AIError("malformed", "Anthropic did not stream a reply.");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let text = "";
        let firstTokenMs: number | undefined;
        let outputTokens: number | undefined;
        t.rearm(STREAM_IDLE_MS);

        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          t.rearm(STREAM_IDLE_MS);
          buf += decoder.decode(chunk.value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).replace(/\r$/, "").trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            const evt = JSON.parse(data) as Record<string, unknown>;
            if (evt.type === "content_block_delta") {
              const delta = evt.delta as { text?: unknown } | undefined;
              if (typeof delta?.text === "string" && delta.text) {
                firstTokenMs ??= Math.round(clock() - start);
                text += delta.text;
                options.onToken?.(delta.text);
              }
            } else if (evt.type === "message_delta") {
              const u = evt.usage as { output_tokens?: unknown } | undefined;
              if (typeof u?.output_tokens === "number") outputTokens = u.output_tokens;
            }
          }
        }
        if (!text) throw new AIError("malformed", "Anthropic stream ended without text.");
        return {
          text,
          metrics: { firstTokenMs, totalMs: Math.round(clock() - start), outputTokens },
        };
      } finally {
        t.done();
      }
    },
  };
}
