import { describe, expect, it } from "vitest";
import { CLOUD_PROVIDERS } from "../../../src/features/ai/CloudProviders";
import { PROVIDERS } from "../../../src/features/ai/providers";
import { evaluateCloudCredentialStatus } from "../../../src/features/ai/taskModels";

describe("cloud providers", () => {
  it("lists only real cloud services", () => {
    expect(CLOUD_PROVIDERS).toEqual(["openai", "gemini", "anthropic", "custom_cloud"]);
    expect(CLOUD_PROVIDERS.every((id) => PROVIDERS[id].local === false)).toBe(true);
  });

  it("is never ready, with or without a key, because there is no secure place to keep one", () => {
    for (const id of CLOUD_PROVIDERS) {
      for (const hasKey of [false, true]) {
        const status = evaluateCloudCredentialStatus(id, PROVIDERS[id].defaultBaseUrl, hasKey);
        expect(status.ready, `${id} hasKey=${hasKey}`).toBe(false);
        expect(status.mode).toBe("setup_required");
      }
    }
  });

  it("does not become ready by pointing a cloud provider at a loopback address", () => {
    expect(evaluateCloudCredentialStatus("openai", "http://127.0.0.1:8080/v1", true).ready).toBe(false);
  });
});
