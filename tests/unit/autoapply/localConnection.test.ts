import { describe, expect, it } from "vitest";
import { disconnectedSnapshot, effectiveExtensionModel, validateExtensionDestination } from "../../../apps/extension/src/ai/localConnection";
import { evaluateCloudCredentialStatus } from "../../../src/features/ai/taskModels";
import { sendBlocker, initialConnection, connectionReducer } from "../../../src/features/ai/connectionState";

describe("extension AI destinations", () => {
  it("allows keyless loopback providers and blocks cloud and remote endpoints", () => {
    expect(validateExtensionDestination("ollama", "http://127.0.0.1:11434/v1")).toBeNull();
    expect(validateExtensionDestination("lmstudio", "http://localhost:1234/v1")).toBeNull();
    expect(validateExtensionDestination("openai", "https://api.openai.com/v1")).toMatch(/Cloud setup required/);
    expect(validateExtensionDestination("custom", "https://remote.example/v1")).toMatch(/only connects directly/);
    expect(validateExtensionDestination("ollama", "http://user:pass@localhost:11434/v1")).toMatch(/username or password/);
  });

  it("invalidates connection on destination change and uses task overrides", () => {
    const disconnected = disconnectedSnapshot("ollama", "http://localhost:11434/v1", "model-a");
    expect(disconnected.connected).toBe(false);
    expect(disconnected.keyless).toBe(true);
    expect(effectiveExtensionModel({ ...disconnected, taskModels: { cover_letter: "model-b" } }, "cover_letter")).toBe("model-b");
    expect(effectiveExtensionModel(disconnected, "job_analysis")).toBe("model-a");
  });

  it("does not infer an authenticated cloud companion from a loopback URL or memory key", () => {
    expect(evaluateCloudCredentialStatus("openai", "http://127.0.0.1:8765/v1", false).ready).toBe(false);
    expect(evaluateCloudCredentialStatus("openai", "https://api.openai.com/v1", true).ready).toBe(false);
    let state = initialConnection("openai");
    state = connectionReducer(state, { type: "model", model: "example" });
    state = connectionReducer(state, { type: "consent", value: true });
    state = connectionReducer(state, { type: "apiKey", apiKey: "synthetic-key" });
    expect(sendBlocker(state)).toMatch(/Cloud AI is unavailable/);
  });
});
