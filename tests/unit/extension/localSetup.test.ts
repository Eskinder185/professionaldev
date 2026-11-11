import { afterEach, describe, expect, it, vi } from "vitest";
import { AIError, type ModelInfo } from "../../../src/features/ai/client";
import { LOCAL_CANDIDATES, type DiscoveryResult } from "../../../src/features/ai/discovery";
import {
  checkSavedConnection,
  connectAndTest,
  DISCOVERY_CONSENT_KEY,
  guideSteps,
  parseBillions,
  plainError,
  rankModels,
  readDiscoveryConsent,
  revokeDiscoveryConsent,
  summarizeDiscovery,
  writeDiscoveryConsent,
} from "../../../apps/extension/src/ai/localSetup";
import type { AIConnectionSnapshot } from "../../../packages/careeros-shared/types";

const ollama = LOCAL_CANDIDATES[0]!;
const lmstudio = LOCAL_CANDIDATES[1]!;
const model = (id: string, parameterSize?: string): ModelInfo => ({ id, parameterSize });

describe("model ranking", () => {
  const models = [model("llama3.2:3b", "3.2B"), model("qwen3:14b", "14B"), model("tinyllama:1.1b", "1.1B"), model("qwen3:8b", "8B")];
  const ranked = rankModels(ollama, models);

  it("recommends the most capable model that suits CareerOS tasks", () => {
    expect(ranked.recommended?.model.id).toBe("qwen3:14b");
  });
  it("offers the smallest suitable model as fastest, only when it differs", () => {
    expect(ranked.fastest?.model.id).toBe("llama3.2:3b");
    expect(rankModels(ollama, [model("qwen3:8b", "8B")]).fastest).toBeNull();
  });
  it("keeps unsuitable models available with a plain caution", () => {
    const tiny = ranked.others.find((m) => m.model.id === "tinyllama:1.1b")!;
    expect(tiny.suitable).toBe(false);
    expect(tiny.caution).toMatch(/too small/i);
    expect(ranked.others.map((m) => m.model.id)).toContain("qwen3:8b");
  });
  it("never recommends when nothing is suitable", () => {
    const only = rankModels(ollama, [model("tinyllama:1.1b", "1.1B")]);
    expect(only.recommended).toBeNull();
    expect(only.others).toHaveLength(1);
  });
  it("reads sizes from what the app reports", () => {
    expect(parseBillions(model("x", "3.2B"))).toBe(3.2);
    expect(parseBillions(model("qwen3:14b"))).toBe(14);
    expect(parseBillions(model("mystery"))).toBeNull();
  });
});

describe("discovery summary", () => {
  it("groups what was found", () => {
    const results: DiscoveryResult[] = [
      { status: "found", candidate: ollama, models: [model("qwen3:8b", "8B")], latencyMs: 5 },
      { status: "unreachable", candidate: lmstudio },
    ];
    const out = summarizeDiscovery(results);
    expect(out.kind).toBe("found");
    if (out.kind === "found") expect(out.services.map((s) => s.candidate.provider)).toEqual(["ollama"]);
  });
  it("reports nothing found, with apps that run but have no models", () => {
    const out = summarizeDiscovery([{ status: "empty", candidate: ollama }, { status: "unreachable", candidate: lmstudio }]);
    expect(out).toMatchObject({ kind: "none", empty: [ollama] });
  });
  it("checks only the two standard addresses", () => {
    expect(LOCAL_CANDIDATES.map((c) => c.baseUrl)).toEqual(["http://127.0.0.1:11434/v1", "http://127.0.0.1:1234/v1"]);
  });
});

describe("plain-language errors", () => {
  it("never leaks technical detail", () => {
    for (const kind of ["network", "timeout", "model_not_found", "auth", "malformed", "server", "bad_request"] as const) {
      const text = plainError(new AIError(kind, "TypeError: fetch failed at stack frame 0x1 status 500"));
      expect(text).not.toMatch(/TypeError|stack|0x1|500|fetch/);
    }
    expect(plainError(new Error("Failed to fetch https://secret"))).not.toMatch(/secret|fetch/);
    expect(plainError(new DOMException("aborted", "AbortError"))).toBe("Stopped.");
  });
});

describe("remembered permission", () => {
  const fake = () => {
    const data: Record<string, unknown> = {};
    return { get: async (k: string) => ({ [k]: data[k] }), set: async (o: Record<string, unknown>) => void Object.assign(data, o), remove: async (k: string) => void delete data[k], data };
  };
  it("starts unasked, can be allowed or declined, and can be taken back", async () => {
    const s = fake();
    expect(await readDiscoveryConsent(s)).toBeNull();
    await writeDiscoveryConsent("allowed", s);
    expect(await readDiscoveryConsent(s)).toBe("allowed");
    await writeDiscoveryConsent("declined", s);
    expect(await readDiscoveryConsent(s)).toBe("declined");
    await writeDiscoveryConsent("allowed", s);
    await revokeDiscoveryConsent(s);
    expect(await readDiscoveryConsent(s)).toBeNull();
    expect(DISCOVERY_CONSENT_KEY in s.data).toBe(false);
  });
  it("treats unreadable storage as not asked", async () => {
    expect(await readDiscoveryConsent({ get: async () => { throw new Error("blocked"); }, set: async () => undefined })).toBeNull();
    expect(await readDiscoveryConsent(null)).toBeNull();
  });
});

describe("verified connection", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const server = (opts: { models?: string[]; reply?: string; down?: boolean } = {}) =>
    (async (input: RequestInfo | URL) => {
      if (opts.down) throw new TypeError("Failed to fetch");
      const url = String(input);
      if (url.endsWith("/api/version")) return json({ version: "0.6.0" });
      if (url.endsWith("/api/tags")) return json({ models: (opts.models ?? ["qwen3:8b"]).map((name) => ({ name, model: name, details: { parameter_size: "8B" } })) });
      if (url.endsWith("/api/show")) return json({ details: {}, capabilities: ["completion"] });
      if (url.endsWith("/api/chat")) return json({ message: { role: "assistant", content: opts.reply ?? "ready" }, done: true });
      return json({}, 404);
    }) as unknown as typeof fetch;
  const saved = { provider: "ollama", providerLabel: "Ollama (local)", baseUrl: "http://127.0.0.1:11434", model: "qwen3:8b", connected: true, isLocal: true, keyless: true } as unknown as AIConnectionSnapshot;

  it("a saved connection is available only if the service answers and the model is installed", async () => {
    expect(await checkSavedConnection(saved, undefined, { fetchImpl: server() })).toEqual({ ok: true });
    const down = await checkSavedConnection(saved, undefined, { fetchImpl: server({ down: true }) });
    expect(down).toMatchObject({ ok: false, reason: "service" });
    const gone = await checkSavedConnection(saved, undefined, { fetchImpl: server({ models: ["other:1b"] }) });
    expect(gone).toMatchObject({ ok: false, reason: "model" });
    expect((gone as { message: string }).message).toMatch(/isn.t installed/);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("is connected only after the model really replies", async () => {
    vi.stubGlobal("fetch", server());
    const ok = await connectAndTest("ollama", saved.baseUrl, "qwen3:8b", null);
    expect(ok).toMatchObject({ connected: true, model: "qwen3:8b", isLocal: true, keyless: true });
  });

  it("an empty reply is a failure, not a connection", async () => {
    vi.stubGlobal("fetch", server({ reply: "   " }));
    await expect(connectAndTest("ollama", saved.baseUrl, "qwen3:8b", null)).rejects.toThrow();
  });

  it("a model the server doesn't list is refused before any chat", async () => {
    vi.stubGlobal("fetch", server({ models: ["other:1b"] }));
    await expect(connectAndTest("ollama", saved.baseUrl, "qwen3:8b", null)).rejects.toThrow(/did not list/);
  });
});

describe("setup guide", () => {
  it("gives official links and a copyable command, and runs nothing", () => {
    const steps = guideSteps("ollama", "windows", { ollama: "qwen3.5:4b", lmStudio: "qwen/qwen3.5-4b" });
    expect(steps[0]!.link?.href).toBe("https://ollama.com/download");
    expect(steps.find((s) => s.command)?.command).toBe("ollama pull qwen3.5:4b");
    const lm = guideSteps("lmstudio", "mac", { ollama: "x", lmStudio: "qwen/qwen3.5-4b" });
    expect(lm[0]!.title).toContain("macOS");
    expect(lm[0]!.link?.href).toBe("https://lmstudio.ai/");
    expect(lm.some((s) => s.command)).toBe(false);
  });
});
