import { describe, expect, it } from "vitest";
import { validateVisualReply, visionSupport, visualFallbackReason } from "../../../apps/extension/src/ai/visualPage";
import { buildChatBody } from "../../../src/features/ai/client";
import type { AIConnectionSnapshot, DetectedField, PageContext } from "../../../packages/careeros-shared/types";

const snap = (model: string, extra: Partial<AIConnectionSnapshot> = {}) => ({ provider: "ollama", providerLabel: "Ollama", baseUrl: "http://127.0.0.1:11434", model, connected: true, isLocal: true, keyless: true, capabilities: [], ...extra }) as unknown as AIConnectionSnapshot;
const field = (label: string) => ({ id: label, label, inputType: "text" }) as DetectedField;
const page = (over: Partial<PageContext>) => ({ supported: true, url: "https://x.test", fields: [], job: null, intelligence: null, embeddedFrames: [], ...over }) as unknown as PageContext;

describe("vision support", () => {
  it("refuses honestly when no model, or a text-only model, is connected", () => {
    expect(visionSupport(null).level).toBe("no");
    const text = visionSupport(snap("llama3.2:3b"));
    expect(text.level).toBe("no");
    expect(text.reason).toMatch(/vision-capable/);
  });
  it("accepts models that report or are named as vision models", () => {
    expect(visionSupport(snap("whatever", { capabilities: ["Vision (estimated)"] })).level).toBe("yes");
    for (const m of ["llava:7b", "qwen2.5vl:7b", "gemma3:4b", "llama3.2-vision:11b", "minicpm-v"]) expect(visionSupport(snap(m)).level).toBe("likely");
  });
});

describe("when the fallback is offered", () => {
  it("is not offered when the structure was read reliably", () => {
    const reliable = page({ job: { title: "Engineer" } as never, fields: [field("First name")], intelligence: { confidence: "high" } as never });
    expect(visualFallbackReason(reliable, true)).toBeNull();
  });
  it("is offered for unreadable pages, cross-site frames, and pages with nothing found", () => {
    expect(visualFallbackReason(null, false)).toMatch(/couldn.t read/);
    expect(visualFallbackReason(page({ embeddedFrames: [{ url: "u", host: "h", platformLabel: "Greenhouse" }] }), true)).toMatch(/frame/);
    expect(visualFallbackReason(page({}), true)).toMatch(/didn.t find/);
  });
});

describe("visual observations", () => {
  const reply = (observations: unknown[], summary = "A job application form.") => JSON.stringify({ summary, observations });
  const fields = [field("First Name"), field("Email")];

  it("marks form fields confirmed only when the real form has them", () => {
    const out = validateVisualReply(reply([{ kind: "form_field", text: "First name" }, { kind: "form_field", text: "Favourite colour" }, { kind: "job_title", text: "Support Engineer" }]), fields);
    expect(out.observations.map((o) => [o.text, o.confirmedByForm])).toEqual([["First name", true], ["Favourite colour", false], ["Support Engineer", false]]);
  });

  it("drops personal details and malformed entries", () => {
    const out = validateVisualReply(reply([{ kind: "other", text: "Contact jane.doe@example.com" }, { kind: "other", text: "Call +1 (404) 555-0199" }, { kind: "nonsense", text: "x" }, { kind: "button", text: "Next" }]), []);
    expect(out.observations.map((o) => o.text)).toEqual(["Next"]);
    expect(out.rejected).toBe(3);
  });

  it("rejects unreadable replies instead of inventing a result", () => {
    expect(() => validateVisualReply("I cannot see any image.", [])).toThrow(/vision-capable/);
    expect(() => validateVisualReply(reply([], ""), [])).toThrow(/Nothing readable/);
  });
});

describe("image messages", () => {
  const target = { baseUrl: "http://127.0.0.1:1234/v1", model: "m", apiKey: "", structured: "prompt" as const };
  it("sends images as content parts and leaves text-only messages unchanged", () => {
    const body = buildChatBody(target, [{ role: "system", content: "s" }, { role: "user", content: "look", images: ["QUJD"] }]) as { messages: Array<{ content: unknown }> };
    expect(body.messages[0]!.content).toBe("s");
    expect(body.messages[1]!.content).toEqual([{ type: "text", text: "look" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } }]);
  });
});
