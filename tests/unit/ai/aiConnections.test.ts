import { describe, expect, it } from "vitest";
import { isLoopbackHost, validateEndpoint } from "../../../src/features/ai/endpoint";
import { connectionReducer, initialConnection, isConnected, sendBlocker } from "../../../src/features/ai/connectionState";
import { AIError, createOpenAICompatibleAdapter } from "../../../src/features/ai/client";
import { createOllamaAdapter, ollamaBase } from "../../../src/features/ai/ollama";
import {
  extractJsonBlock,
  findFabricatedNumbers,
  validateAIInterviewFeedback,
  validateAIJobExtraction,
  validateAISuggestions,
} from "../../../src/features/ai/structured";

describe("AI endpoint validation & security rules", () => {
  it("recognizes loopback hosts and rejects LAN or remote HTTP URLs", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("192.168.1.50")).toBe(false);

    expect(validateEndpoint("http://127.0.0.1:11434/v1")).toMatchObject({
      ok: true,
      baseUrl: "http://127.0.0.1:11434/v1",
      host: "127.0.0.1:11434",
      isLoopback: true,
    });
    expect(validateEndpoint("http://localhost:1234/v1/")).toMatchObject({
      ok: true,
      baseUrl: "http://localhost:1234/v1",
      isLoopback: true,
    });
    expect(validateEndpoint("http://api.example.com/v1")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Remote servers must use HTTPS/),
    });
    expect(validateEndpoint("https://api.openai.com/v1")).toMatchObject({
      ok: true,
      baseUrl: "https://api.openai.com/v1",
      isLoopback: false,
    });
    expect(validateEndpoint("https://user:secret@api.example.com/v1")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/username or password/),
    });
  });

  it("clears API key, model list, consent, and connected status when provider or endpoint changes", () => {
    let state = initialConnection("ollama");
    state = connectionReducer(state, { type: "apiKey", apiKey: "sk-secret123456" });
    state = connectionReducer(state, { type: "model", model: "llama3.2:latest" });
    state = connectionReducer(state, { type: "consent", value: true });
    state = connectionReducer(state, { type: "models", models: [{ id: "llama3.2:latest" }] });
    state = connectionReducer(state, {
      type: "status",
      status: { kind: "connected", checkedAt: Date.now(), detail: "Ready" },
    });
    expect(isConnected(state)).toBe(true);

    // Changing endpoint clears key, consent, models, and status
    const afterUrlChange = connectionReducer(state, {
      type: "baseUrl",
      baseUrl: "http://127.0.0.1:1234/v1",
    });
    expect(afterUrlChange.apiKey).toBe("");
    expect(afterUrlChange.consentFor).toBeNull();
    expect(afterUrlChange.models).toBeNull();
    expect(afterUrlChange.status.kind).toBe("idle");
    expect(isConnected(afterUrlChange)).toBe(false);

    // Changing provider also clears key, consent, models, and status
    const afterProviderChange = connectionReducer(state, {
      type: "provider",
      provider: "lmstudio",
    });
    expect(afterProviderChange.apiKey).toBe("");
    expect(afterProviderChange.consentFor).toBeNull();
    expect(afterProviderChange.models).toBeNull();
    expect(afterProviderChange.status.kind).toBe("idle");
  });

  it("blocks sending any request until destination consent is granted", () => {
    let state = initialConnection("ollama");
    state = connectionReducer(state, { type: "model", model: "qwen2.5:7b" });
    expect(sendBlocker(state)).toMatch(/Confirm that CareerOS may send requests/);
    state = connectionReducer(state, { type: "consent", value: true });
    expect(sendBlocker(state)).toBeNull();
  });
});

describe("Ollama & OpenAI-compatible adapters", () => {
  it("strips /v1 for Ollama native calls and falls back to /v1 when needed", async () => {
    expect(ollamaBase("http://127.0.0.1:11434/v1")).toBe("http://127.0.0.1:11434");
    expect(ollamaBase("http://127.0.0.1:11434")).toBe("http://127.0.0.1:11434");

    // Mock server speaking native Ollama /api/tags and /api/chat
    const nativeAdapter = createOllamaAdapter(async (url) => {
      const u = String(url);
      if (u.endsWith("/api/version")) {
        return new Response(JSON.stringify({ version: "0.6.2" }), { status: 200 });
      }
      if (u.endsWith("/api/tags")) {
        return new Response(
          JSON.stringify({ models: [{ name: "llama3.2:latest", details: { parameter_size: "3B" } }] }),
          { status: 200 },
        );
      }
      if (u.endsWith("/api/chat")) {
        return new Response(
          JSON.stringify({ message: { content: '{"suggestions":[]}' }, eval_count: 12, eval_duration: 500_000_000 }),
          { status: 200 },
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const target = {
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "llama3.2:latest",
      apiKey: "",
      structured: "prompt" as const,
    };
    const probe = await nativeAdapter.probe(target);
    expect(probe.version).toBe("0.6.2");
    const models = await nativeAdapter.listModels(target);
    expect(models?.map((m) => m.id)).toEqual(["llama3.2:latest"]);
    const chatRes = await nativeAdapter.chat(target, [{ role: "user", content: "hi" }]);
    expect(chatRes.text).toBe('{"suggestions":[]}');
  });

  it("never leaks the API key in error messages and blocks redirects", async () => {
    const secretKey = "sk-test-supersecretkey999999";
    const adapter = createOpenAICompatibleAdapter(async () => {
      return new Response(
        JSON.stringify({ error: { message: `Invalid key ${secretKey} provided.` } }),
        { status: 401 },
      );
    });
    await expect(
      adapter.listModels({ baseUrl: "https://api.openai.com/v1", apiKey: secretKey }),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(AIError);
      expect((err as Error).message).not.toContain(secretKey);
      expect((err as Error).message).toContain("[key]");
      return true;
    });
  });
});

describe("Structured AI output validation & anti-fabrication guards", () => {
  it("extracts JSON from <think> blocks and markdown code fences", () => {
    expect(extractJsonBlock("<think>reasoning</think>```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
    const raw = `<think>Let me analyze the bullet carefully.</think>\nHere is the suggestion:\n\`\`\`json\n{"suggestions":[{"actionType":"make-concise","originalText":"Responsible for managing Linux servers.","proposedText":"Managed Linux servers.","reason":"Shorter and starts with an action verb.","evidenceReference":"Experience","relatedRequirement":"Linux","confidence":"high","requiresConfirmation":true}]}\n\`\`\``;
    const validated = validateAISuggestions(raw, "Responsible for managing Linux servers.", "Managed Linux servers.");
    expect(validated).toHaveLength(1);
    expect(validated[0]).toMatchObject({
      actionType: "make-concise",
      proposedText: "Managed Linux servers.",
      confidence: "high",
      requiresConfirmation: true,
    });
  });

  it("rejects AI suggestions that fabricate unverified numbers or percentages outside [brackets]", () => {
    const corpus = "Automated account provisioning with PowerShell and Active Directory.";
    expect(findFabricatedNumbers(corpus, "Automated account provisioning with PowerShell, cutting ticket time by 47%.")).toEqual(["47%"]);
    // Bracketed placeholders ARE allowed:
    expect(findFabricatedNumbers(corpus, "Automated account provisioning with PowerShell, cutting ticket time by [X%].")).toEqual([]);

    const badJson = JSON.stringify({
      suggestions: [
        {
          actionType: "improve-bullet",
          originalText: corpus,
          proposedText: "Automated account provisioning with PowerShell, reducing onboarding time by 65%.",
          reason: "Added metric",
          evidenceReference: "Experience",
          relatedRequirement: "PowerShell",
          confidence: "high",
          requiresConfirmation: true,
        },
      ],
    });
    expect(() => validateAISuggestions(badJson, corpus, corpus)).toThrow(/introduced unverified numbers \(65%\)/);
  });

  it("validates AI job extraction and filters out locations, US states, and salary tokens", () => {
    const jd = "Location: Atlanta, GA. Pay: $90,000 USD. Must know Linux and TCP/IP.";
    const raw = JSON.stringify({
      metadata: { company: "Example Corp", location: "Atlanta, GA", workMode: "On-site" },
      requirements: [
        { term: "Linux", category: "Operating Systems", kind: "required", excerpt: "Must know Linux and TCP/IP." },
        { term: "GA", category: "Other", kind: "required", excerpt: "Location: Atlanta, GA." },
        { term: "Atlanta, GA", category: "Other", kind: "required", excerpt: "Location: Atlanta, GA." },
        { term: "USD", category: "Other", kind: "required", excerpt: "$90,000 USD" },
      ],
    });
    const res = validateAIJobExtraction(raw, jd);
    expect(res.requirements.map((r) => r.term)).toEqual(["Linux"]);
    expect(res.metadata.company).toBe("Example Corp");
  });

  it("validates AI interview coach feedback schema", () => {
    const raw = JSON.stringify({
      overallSummary: "Clear STAR example demonstrating Linux troubleshooting.",
      starEvaluation: {
        situation: "Production server outage.",
        task: "Restore service within SLA.",
        action: "Inspected journalctl logs and restarted systemd unit.",
        result: "Service restored in 10 minutes.",
      },
      technicalAccuracy: "Accurate use of systemd and journalctl.",
      jobAlignment: "Directly matches Linux administration requirement.",
      followUpExamples: ["Describe how you prevented recurrence."],
    });
    const feedback = validateAIInterviewFeedback(raw);
    expect(feedback.overallSummary).toMatch(/Clear STAR example/);
    expect(feedback.starEvaluation.action).toMatch(/journalctl/);
  });
});
