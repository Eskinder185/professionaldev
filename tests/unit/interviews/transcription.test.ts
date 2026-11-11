import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureCloudWhisper,
  configureLocalWhisper,
  getTranscriptionProvider,
  InBrowserWhisperProvider,
  LocalWhisperServiceProvider,
  CloudWhisperProvider,
  transcribeAnswerAudio,
} from "../../../src/features/interviews/transcription";
import { generateSilentAudio, generateSyntheticSpeechAudio } from "../../fixtures/audio";

describe("transcription provider architecture", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to InBrowserWhisperProvider as the primary on-device engine", () => {
    const provider = getTranscriptionProvider("whisper-browser");
    expect(provider).toBeInstanceOf(InBrowserWhisperProvider);
    expect(provider.id).toBe("whisper-browser");
  });

  it("configures and retrieves LocalWhisperServiceProvider", () => {
    configureLocalWhisper({ baseUrl: "http://127.0.0.1:8080/v1" });
    const provider = getTranscriptionProvider("whisper-local");
    expect(provider).toBeInstanceOf(LocalWhisperServiceProvider);
    expect(provider.id).toBe("whisper-local");
  });

  it("throws clear error when Cloud Whisper is requested without credentials", () => {
    expect(() => getTranscriptionProvider("whisper-cloud")).toThrow(/not configured/);
  });

  it("configures and retrieves CloudWhisperProvider when credentials provided", () => {
    configureCloudWhisper({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-test" });
    const provider = getTranscriptionProvider("whisper-cloud");
    expect(provider).toBeInstanceOf(CloudWhisperProvider);
  });

  it("InBrowserWhisperProvider handles silent audio without triggering model inference", async () => {
    const provider = new InBrowserWhisperProvider();
    const silent = generateSilentAudio(2);
    const progressSpy = vi.fn();

    const result = await provider.transcribe(silent, { onProgress: progressSpy });
    expect(result.text).toBe("");
    expect(result.segments).toEqual([]);
    expect(result.durationSec).toBe(2);
    expect(result.engine).toBe("whisper-browser");
  });

  it("LocalWhisperServiceProvider reports available false when service is offline", async () => {
    const provider = new LocalWhisperServiceProvider({ baseUrl: "http://127.0.0.1:9999/v1" });
    const status = await provider.isAvailable();
    expect(status.available).toBe(false);
    expect(status.reason).toContain("Could not connect");
  });

  it("LocalWhisperServiceProvider parses verbose_json segments correctly", async () => {
    const mockJson = {
      text: "When I received feedback on the API design, I restructured the endpoints.",
      segments: [
        { start: 0.5, end: 3.2, text: "When I received feedback on the API design," },
        { start: 3.3, end: 6.0, text: "I restructured the endpoints." },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockJson,
    } as Response);

    const provider = new LocalWhisperServiceProvider({ baseUrl: "http://127.0.0.1:8080/v1" });
    const audio = generateSyntheticSpeechAudio(3);
    const result = await provider.transcribe(audio);

    expect(result.text).toBe("When I received feedback on the API design, I restructured the endpoints.");
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toEqual({ t: 0.5, text: "When I received feedback on the API design," });
    expect(result.segments[1]).toEqual({ t: 3.3, text: "I restructured the endpoints." });
  });

  it("LocalWhisperServiceProvider formats server errors with status code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "GPU model out of memory",
    } as Response);

    const provider = new LocalWhisperServiceProvider({ baseUrl: "http://127.0.0.1:8080/v1" });
    const audio = generateSyntheticSpeechAudio(2);
    await expect(provider.transcribe(audio)).rejects.toThrow(/503.*GPU model out of memory/);
  });

  it("CloudWhisperProvider sends authorization header and parses result", async () => {
    const mockJson = { text: "I rolled back the server update and verified DNS." };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockJson,
    } as Response);

    const provider = new CloudWhisperProvider({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-mock-key" });
    const audio = generateSyntheticSpeechAudio(2);
    const result = await provider.transcribe(audio);

    expect(result.text).toBe("I rolled back the server update and verified DNS.");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        headers: { Authorization: "Bearer sk-mock-key" },
      })
    );
  });

  it("transcribeAnswerAudio routes correctly through orchestrator", async () => {
    const silent = generateSilentAudio(1.5);
    const result = await transcribeAnswerAudio(silent, "whisper-browser");
    expect(result.text).toBe("");
    expect(result.durationSec).toBe(1.5);
  });
});
