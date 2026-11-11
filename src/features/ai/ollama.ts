/**
 * Ollama adapter (supports default base URL http://127.0.0.1:11434/v1 and http://127.0.0.1:11434).
 *
 * Uses Ollama's native endpoints (/api/version, /api/tags, /api/show, /api/chat) for rich
 * model metadata, token metrics, and `think: false` support, and transparently falls back
 * to OpenAI-compatible /v1/models and /v1/chat/completions when a server or mock only
 * exposes /v1/* endpoints.
 */
import {
  AIError,
  CHAT_TIMEOUT_MS,
  MODELS_TIMEOUT_MS,
  checkedBase,
  clock,
  createOpenAICompatibleAdapter,
  requestJson,
  requestLines,
  type AIAdapter,
  type ChatMetrics,
  type Fetch,
  type ModelInfo,
} from "./client";

/** Accepts ".../v1" too, since http://127.0.0.1:11434/v1 is the standard Ollama OpenAI-compat URL. */
export function ollamaBase(baseUrl: string): string {
  return checkedBase(baseUrl).replace(/\/v1$/, "");
}

export function ollamaV1Base(baseUrl: string): string {
  return `${ollamaBase(baseUrl)}/v1`;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined);

export function parseTags(body: unknown): ModelInfo[] {
  const models = (body as { models?: unknown }).models;
  if (!Array.isArray(models)) throw new AIError("malformed", "Ollama’s model list wasn’t in the expected format.");
  const out: ModelInfo[] = [];
  for (const m of models) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const id = str(r.name) ?? str(r.model);
    if (!id) continue;
    const d = (r.details && typeof r.details === "object" ? r.details : {}) as Record<string, unknown>;
    out.push({
      id,
      sizeBytes: num(r.size),
      parameterSize: str(d.parameter_size),
      quantization: str(d.quantization_level),
      family: str(d.family),
      contextLength: num(d.context_length),
      capabilities: strings(r.capabilities),
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function parseShow(model: string, body: unknown): ModelInfo {
  const r = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const info = (r.model_info && typeof r.model_info === "object" ? r.model_info : {}) as Record<string, unknown>;
  const ctxKey = Object.keys(info).find((k) => k.endsWith(".context_length"));
  const d = (r.details && typeof r.details === "object" ? r.details : {}) as Record<string, unknown>;
  return {
    id: model,
    parameterSize: str(d.parameter_size),
    quantization: str(d.quantization_level),
    family: str(d.family),
    contextLength: ctxKey ? num(info[ctxKey]) : undefined,
    capabilities: strings(r.capabilities),
  };
}

export function createOllamaAdapter(fetchImpl: Fetch = (...a) => fetch(...a)): AIAdapter {
  const openAiFallback = createOpenAICompatibleAdapter(fetchImpl);

  return {
    kind: "ollama",
    async probe(target, signal) {
      const base = ollamaBase(target.baseUrl);
      const start = clock();
      try {
        const body = await requestJson(fetchImpl, `${base}/api/version`, { method: "GET", apiKey: target.apiKey, signal, timeoutMs: MODELS_TIMEOUT_MS });
        const version = str((body as { version?: unknown }).version);
        if (!version) throw new AIError("malformed", "Something answered, but it doesn’t look like Ollama.");
        return { latencyMs: Math.round(clock() - start), version };
      } catch (e) {
        if (e instanceof AIError && e.kind === "not_found") {
          return openAiFallback.probe({ ...target, baseUrl: ollamaV1Base(target.baseUrl) }, signal);
        }
        throw e;
      }
    },
    async listModels(target, signal) {
      const base = ollamaBase(target.baseUrl);
      try {
        const body = await requestJson(fetchImpl, `${base}/api/tags`, { method: "GET", apiKey: target.apiKey, signal, timeoutMs: MODELS_TIMEOUT_MS });
        if (body && typeof body === "object" && !Array.isArray((body as { models?: unknown }).models) && Array.isArray((body as { data?: unknown }).data)) {
          return openAiFallback.listModels({ ...target, baseUrl: ollamaV1Base(target.baseUrl) }, signal);
        }
        return parseTags(body);
      } catch (e) {
        if (e instanceof AIError && e.kind === "not_found") {
          return openAiFallback.listModels({ ...target, baseUrl: ollamaV1Base(target.baseUrl) }, signal);
        }
        throw e;
      }
    },
    async describeModel(target, model, signal) {
      const base = ollamaBase(target.baseUrl);
      const body = await requestJson(fetchImpl, `${base}/api/show`, { method: "POST", apiKey: target.apiKey, body: { model }, signal, timeoutMs: MODELS_TIMEOUT_MS, model });
      return parseShow(model, body);
    },
    async chat(target, messages, options = {}) {
      const base = ollamaBase(target.baseUrl);
      if (!target.model.trim()) throw new AIError("bad_request", "Choose a model first.");
      const body: Record<string, unknown> = { model: target.model, messages, stream: !!options.stream };
      if (options.format) body.format = options.format.schema;
      if (target.capabilities?.includes("thinking")) body.think = false;
      const init = { method: "POST" as const, apiKey: target.apiKey, body, signal: options.signal, timeoutMs: options.timeoutMs ?? CHAT_TIMEOUT_MS, model: target.model };
      const start = clock();

      const finalMetrics = (final: Record<string, unknown> | null, firstTokenMs?: number): ChatMetrics => {
        const evalCount = num(final?.eval_count);
        const evalNs = num(final?.eval_duration);
        return {
          firstTokenMs,
          totalMs: Math.round(clock() - start),
          outputTokens: evalCount,
          tokensPerSecond: evalCount && evalNs ? Math.round((evalCount / evalNs) * 1e9 * 10) / 10 : undefined,
        };
      };

      if (!options.stream) {
        try {
          const res = (await requestJson(fetchImpl, `${base}/api/chat`, init)) as Record<string, unknown>;
          const text = str((res.message as { content?: unknown } | undefined)?.content);
          if (text === undefined) throw new AIError("malformed", "Ollama replied without any message text.");
          return { text, metrics: finalMetrics(res) };
        } catch (e) {
          if (e instanceof AIError && e.kind === "not_found") {
            return openAiFallback.chat({ ...target, baseUrl: ollamaV1Base(target.baseUrl) }, messages, options);
          }
          throw e;
        }
      }

      let text = "";
      let firstTokenMs: number | undefined;
      let final: Record<string, unknown> | null = null;
      try {
        await requestLines(fetchImpl, `${base}/api/chat`, init, (line) => {
          let json: Record<string, unknown>;
          try {
            json = JSON.parse(line);
          } catch {
            throw new AIError("malformed", "Ollama sent a stream CareerOS couldn’t read.");
          }
          if (typeof json.error === "string") throw new AIError("server", `Ollama reported an error: “${json.error.slice(0, 200)}”`);
          const piece = (json.message as { content?: unknown } | undefined)?.content;
          if (typeof piece === "string" && piece) {
            firstTokenMs ??= Math.round(clock() - start);
            text += piece;
            options.onToken?.(piece);
          }
          if (json.done === true) final = json;
        });
      } catch (e) {
        if (e instanceof AIError && e.kind === "not_found") {
          return openAiFallback.chat({ ...target, baseUrl: ollamaV1Base(target.baseUrl) }, messages, options);
        }
        throw e;
      }
      if (!final) throw new AIError("malformed", "The reply ended early. The model may have stopped or run out of memory.");
      return { text, metrics: finalMetrics(final, firstTokenMs) };
    },
  };
}
