/**
 * Google Gemini REST API adapter (https://generativelanguage.googleapis.com/v1beta).
 *
 * Wire protocol differences from OpenAI:
 * - Authentication uses the `x-goog-api-key` HTTP header (never query params, so keys never appear in URLs).
 * - Model discovery uses `GET {base}/models` returning `{ models: [{ name: "models/gemini-2.5-flash", ... }] }`.
 * - Chat generation uses `POST {base}/models/{model}:generateContent` (or `:streamGenerateContent?alt=sse`).
 * - Payload uses `systemInstruction` and `contents: [{ role: "user", parts: [{ text }] }]`.
 * - Structured JSON uses `generationConfig: { responseMimeType: "application/json", responseSchema }`.
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
  type JsonSchemaFormat,
  type ModelInfo,
} from "./client";

function geminiHeaders(apiKey: string, json: boolean): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (json) h["Content-Type"] = "application/json";
  if (apiKey) h["x-goog-api-key"] = apiKey;
  return h;
}

function normalizeGeminiModelId(raw: string): string {
  return raw.trim().replace(/^models\//, "");
}

function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "additionalProperties") continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      copy[k] = toGeminiSchema(v as Record<string, unknown>);
    } else {
      copy[k] = v;
    }
  }
  return copy;
}

export function buildGeminiBody(
  messages: ChatMessage[],
  format?: JsonSchemaFormat,
  structuredMode: "json_schema" | "prompt" = "json_schema",
): Record<string, unknown> {
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => ({ text: m.content }));
  const userMessages = messages.filter((m) => m.role !== "system");

  const contents = (userMessages.length ? userMessages : messages).map((m) => ({
    role: "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };
  if (systemParts.length > 0) {
    body.systemInstruction = { parts: systemParts };
  }

  if (format && structuredMode === "json_schema") {
    body.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(format.schema),
    };
  }
  return body;
}

export function extractGeminiText(body: unknown): string {
  if (!body || typeof body !== "object") {
    throw new AIError("malformed", "Gemini replied with an empty or invalid response.");
  }
  const candidates = (body as { candidates?: unknown }).candidates;
  const first = Array.isArray(candidates) ? candidates[0] : undefined;
  const content =
    first && typeof first === "object" ? (first as { content?: unknown }).content : undefined;
  const parts =
    content && typeof content === "object" ? (content as { parts?: unknown }).parts : undefined;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((p) =>
        p && typeof p === "object" && typeof (p as { text?: unknown }).text === "string"
          ? (p as { text: string }).text
          : "",
      )
      .join("");
    if (joined) return joined;
  }
  throw new AIError("malformed", "Gemini replied without candidate message text.");
}

async function geminiRequestJson(
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
        headers: geminiHeaders(apiKey, body !== undefined),
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
          `No response after ${Math.round(timeoutMs / 1000)} seconds from Gemini.`,
        );
      }
      if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
        throw new AIError("cancelled", "Request cancelled.");
      }
      throw new AIError(
        "network",
        "Couldn’t reach the Gemini API endpoint. Check your network connection or endpoint address.",
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
      throw new AIError("malformed", "Gemini replied, but not with valid JSON.");
    }
  } finally {
    t.done();
  }
}

export function createGeminiAdapter(fetchImpl: Fetch = (...a) => fetch(...a)): AIAdapter {
  const listModels = async (
    target: EndpointTarget,
    signal?: AbortSignal,
  ): Promise<ModelInfo[] | null> => {
    const base = checkedBase(target.baseUrl);
    const body = await geminiRequestJson(
      fetchImpl,
      `${base}/models`,
      "GET",
      target.apiKey,
      undefined,
      signal,
      MODELS_TIMEOUT_MS,
    );
    const rawModels = (body as { models?: unknown }).models;
    if (!Array.isArray(rawModels)) {
      throw new AIError("malformed", "Gemini model list wasn’t in the expected format.");
    }
    const out: ModelInfo[] = [];
    for (const item of rawModels) {
      if (!item || typeof item !== "object") continue;
      const m = item as Record<string, unknown>;
      const rawName = typeof m.name === "string" ? m.name : "";
      if (!rawName) continue;
      const methods = Array.isArray(m.supportedGenerationMethods)
        ? m.supportedGenerationMethods.filter((x): x is string => typeof x === "string")
        : [];
      if (methods.length > 0 && !methods.includes("generateContent")) continue;
      const id = normalizeGeminiModelId(rawName);
      out.push({
        id,
        family: "gemini",
        contextLength:
          typeof m.inputTokenLimit === "number" ? m.inputTokenLimit : undefined,
        capabilities: ["chat", "json_schema", "tools"],
      });
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  };

  return {
    kind: "gemini",
    async probe(target, signal) {
      const start = clock();
      await listModels(target, signal);
      return { latencyMs: Math.round(clock() - start) };
    },
    listModels,
    async describeModel(target, model, signal) {
      const base = checkedBase(target.baseUrl);
      const cleanId = normalizeGeminiModelId(model);
      try {
        const body = (await geminiRequestJson(
          fetchImpl,
          `${base}/models/${encodeURIComponent(cleanId)}`,
          "GET",
          target.apiKey,
          undefined,
          signal,
          MODELS_TIMEOUT_MS,
          cleanId,
        )) as Record<string, unknown>;
        return {
          id: cleanId,
          family: "gemini",
          contextLength:
            typeof body.inputTokenLimit === "number" ? body.inputTokenLimit : undefined,
          capabilities: ["chat", "json_schema", "tools"],
        };
      } catch {
        return null;
      }
    },
    async chat(target: ConnectionTarget, messages: ChatMessage[], options = {}) {
      const base = checkedBase(target.baseUrl);
      const cleanId = normalizeGeminiModelId(target.model);
      if (!cleanId) throw new AIError("bad_request", "Choose a Gemini model first.");
      const start = clock();
      const payload = buildGeminiBody(messages, options.format, target.structured);
      const timeoutMs = options.timeoutMs ?? CHAT_TIMEOUT_MS;

      if (!options.stream) {
        const res = await geminiRequestJson(
          fetchImpl,
          `${base}/models/${encodeURIComponent(cleanId)}:generateContent`,
          "POST",
          target.apiKey,
          payload,
          options.signal,
          timeoutMs,
          cleanId,
        );
        const text = extractGeminiText(res);
        return { text, metrics: { totalMs: Math.round(clock() - start) } };
      }

      // Streaming via SSE (:streamGenerateContent?alt=sse)
      const t = withTimeout(options.signal, timeoutMs);
      try {
        const res = await fetchImpl(
          `${base}/models/${encodeURIComponent(cleanId)}:streamGenerateContent?alt=sse`,
          {
            method: "POST",
            headers: geminiHeaders(target.apiKey, true),
            body: JSON.stringify(payload),
            signal: t.signal,
            redirect: "error",
            credentials: "omit",
            referrerPolicy: "no-referrer",
            cache: "no-store",
            mode: "cors",
          },
        );
        if (!res.ok) {
          let errBody: unknown = null;
          try {
            errBody = JSON.parse(await res.text());
          } catch {
            errBody = null;
          }
          throw errorForStatus(res.status, errBody, target.apiKey, cleanId);
        }
        if (!res.body) throw new AIError("malformed", "Gemini did not stream a reply.");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let text = "";
        let firstTokenMs: number | undefined;
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
            const parsed = JSON.parse(data);
            const piece = extractGeminiText(parsed);
            if (piece) {
              firstTokenMs ??= Math.round(clock() - start);
              text += piece;
              options.onToken?.(piece);
            }
          }
        }
        if (!text) throw new AIError("malformed", "Gemini stream ended without text.");
        return { text, metrics: { firstTokenMs, totalMs: Math.round(clock() - start) } };
      } finally {
        t.done();
      }
    },
  };
}
