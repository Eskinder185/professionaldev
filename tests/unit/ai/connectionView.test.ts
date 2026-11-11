import { describe, expect, it } from "vitest";
import { connectionReducer, initialConnection, type ConnectionState } from "../../../src/features/ai/connectionState";
import { describeHomeAI } from "../../../src/features/ai/connectionView";

const reduce = (state: ConnectionState, ...actions: Parameters<typeof connectionReducer>[1][]) => actions.reduce(connectionReducer, state);
const local = () => reduce(initialConnection("ollama"), { type: "model", model: "llama3.2:3b" }, { type: "consent", value: true });
const inference = { text: "Hello!", metrics: { totalMs: 900 }, at: 1 };

describe("describeHomeAI", () => {
  it("is not configured before a model is chosen", () => {
    expect(describeHomeAI(initialConnection("ollama")).configured).toBe(false);
  });

  it("never says Ready for a saved setting that has not been checked", () => {
    const restored = { ...local(), restored: true, consentFor: null };
    const view = describeHomeAI(restored);
    expect(view.chip.text).toBe("Not checked yet");
    expect(view.ready).toBe(false);
  });

  it("does not say Ready when the server answered but nothing was generated", () => {
    const state = reduce(local(), { type: "status", status: { kind: "connected", checkedAt: 1, detail: "ok" } });
    const view = describeHomeAI(state);
    expect(view.chip.text).toBe("Found, not tested yet");
    expect(view.ready).toBe(false);
  });

  it("says Ready only after a real reply in this session", () => {
    const state = reduce(local(), { type: "status", status: { kind: "connected", checkedAt: 1, detail: "ok" } }, { type: "inference", result: inference });
    const view = describeHomeAI(state);
    expect(view).toMatchObject({ ready: true, chip: { tone: "success", text: "Ready" }, providerLabel: "Ollama", model: "llama3.2:3b", location: "On this computer" });
  });

  it("reports a failure plainly and shows busy while checking", () => {
    expect(describeHomeAI(reduce(local(), { type: "status", status: { kind: "error", message: "boom" } })).chip).toMatchObject({ tone: "danger", text: "Not responding" });
    expect(describeHomeAI(reduce(local(), { type: "status", status: { kind: "testing" } })).chip).toMatchObject({ text: "Checking…", busy: true });
  });

  it("labels cloud providers as cloud", () => {
    const state = reduce(initialConnection("openai"), { type: "model", model: "gpt-4o-mini" });
    expect(describeHomeAI(state).location).toBe("Cloud");
  });

  it("drops the technical suffix from provider names", () => {
    expect(describeHomeAI(reduce(initialConnection("lmstudio"), { type: "model", model: "x" })).providerLabel).toBe("LM Studio");
  });
});
