import { describe, expect, it } from "vitest";
import { DISCOVERY_CONSENT_KEY, LOCAL_CANDIDATES, discoverLocalAI, formatSize, readDiscoveryConsent, suitabilityFor, writeDiscoveryConsent } from "../../../src/features/ai/discovery";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A fake network that records every URL requested and answers per host. */
function fakeNetwork(handlers: Record<string, (url: URL) => Response | Promise<Response>>) {
  const requested: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    requested.push(url.href);
    const handler = handlers[url.host];
    if (!handler) throw new TypeError("Failed to fetch");
    return handler(url);
  }) as typeof fetch;
  return { fetchImpl, requested };
}

const ollamaOk = (models: Array<{ name: string; size?: number }>) => (url: URL) =>
  url.pathname === "/api/version" ? json({ version: "0.6.0" }) : url.pathname === "/api/tags" ? json({ models: models.map((m) => ({ ...m, details: { parameter_size: "3B" } })) }) : json({}, 404);

describe("discoverLocalAI", () => {
  it("contacts only the standard loopback addresses of the two supported apps", async () => {
    const { fetchImpl, requested } = fakeNetwork({});
    await discoverLocalAI({ fetchImpl });
    const hosts = new Set(requested.map((url) => new URL(url).host));
    expect([...hosts].sort()).toEqual(["127.0.0.1:11434", "127.0.0.1:1234"].sort());
    expect(LOCAL_CANDIDATES.map((c) => c.baseUrl)).toEqual(["http://127.0.0.1:11434/v1", "http://127.0.0.1:1234/v1"]);
  });

  it("reports real installed models and ignores embedding-only ones", async () => {
    const { fetchImpl } = fakeNetwork({ "127.0.0.1:11434": ollamaOk([{ name: "llama3.2:3b", size: 2_000_000_000 }, { name: "nomic-embed-text:latest" }]) });
    const [ollama, lmstudio] = await discoverLocalAI({ fetchImpl });
    expect(ollama).toMatchObject({ status: "found", version: "0.6.0" });
    expect(ollama.status === "found" && ollama.models.map((m) => m.id)).toEqual(["llama3.2:3b"]);
    expect(lmstudio.status).toBe("unreachable");
  });

  it("distinguishes a running app with no models from an app that is not reachable", async () => {
    const { fetchImpl } = fakeNetwork({ "127.0.0.1:11434": ollamaOk([]) });
    const [ollama, lmstudio] = await discoverLocalAI({ fetchImpl });
    expect(ollama.status).toBe("empty");
    expect(lmstudio.status).toBe("unreachable");
  });

  it("never invents a model when nothing answers", async () => {
    const { fetchImpl } = fakeNetwork({});
    const results = await discoverLocalAI({ fetchImpl });
    expect(results.every((r) => r.status === "unreachable")).toBe(true);
  });

  it("reports an answering-but-unusable app as a problem with the reason", async () => {
    const { fetchImpl } = fakeNetwork({ "127.0.0.1:1234": () => json({ error: "Unauthorized" }, 401) });
    const results = await discoverLocalAI({ fetchImpl });
    const lm = results.find((r) => r.candidate.provider === "lmstudio");
    expect(lm?.status).toBe("problem");
  });

  it("gives up on a silent app within the time limit and still checks the next one", async () => {
    const hang = ((_: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as typeof fetch;
    const steps: string[] = [];
    const started = performance.now();
    const results = await discoverLocalAI({ fetchImpl: hang, timeoutMs: 80, onStep: (c, phase) => steps.push(`${c.provider}:${phase}`) });
    expect(performance.now() - started).toBeLessThan(2000);
    expect(results.map((r) => r.status)).toEqual(["unreachable", "unreachable"]);
    expect(steps).toContain("lmstudio:checking");
  });

  it("stops when cancelled", async () => {
    const controller = new AbortController();
    const { fetchImpl } = fakeNetwork({ "127.0.0.1:11434": () => { controller.abort(); return json({ version: "x" }); } });
    const results = await discoverLocalAI({ fetchImpl, signal: controller.signal });
    expect(results.length).toBeLessThan(2);
  });
});

describe("consent and formatting", () => {
  it("remembers only an explicit answer", () => {
    expect(readDiscoveryConsent()).toBeNull();
    writeDiscoveryConsent("declined");
    expect(localStorage.getItem(DISCOVERY_CONSENT_KEY)).toBe("declined");
    expect(readDiscoveryConsent()).toBe("declined");
    localStorage.setItem(DISCOVERY_CONSENT_KEY, "garbage");
    expect(readDiscoveryConsent()).toBeNull();
  });

  it("formats sizes and omits unknown ones", () => {
    expect(formatSize(2_000_000_000)).toBe("1.9 GB");
    expect(formatSize(400 * 1024 * 1024)).toBe("400 MB");
    expect(formatSize(undefined)).toBeUndefined();
  });

  it("flags small models as limited for demanding jobs instead of overselling them", () => {
    const [ollama] = LOCAL_CANDIDATES;
    const small = suitabilityFor(ollama, { id: "qwen2.5:0.5b", parameterSize: "0.5B" });
    expect(small.limited.length).toBeGreaterThan(0);
    const larger = suitabilityFor(ollama, { id: "llama3.1:8b", parameterSize: "8B" });
    expect(larger.good.length).toBeGreaterThan(small.good.length);
  });
});

describe("fitSummary", () => {
  it("summarises suitability in one plain sentence", async () => {
    const { fitSummary } = await import("../../../src/features/ai/ConnectSheet");
    expect(fitSummary(["a", "b"], [])).toBe("Suited to everything CareerOS does.");
    expect(fitSummary(["a", "b", "c", "d"], ["x"])).toBe("Good for most CareerOS tasks.");
    expect(fitSummary(["cover letters"], ["a", "b", "c"])).toBe("Best for cover letters.");
    expect(fitSummary([], ["a"])).toBe("Too small for most CareerOS tasks.");
  });
});
