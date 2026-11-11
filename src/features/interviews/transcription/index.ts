/**
 * CareerOS Unified Transcription Subsystem
 *
 * Provides in-browser Whisper (local ONNX/Wasm), local Whisper service (127.0.0.1),
 * and optional Cloud Whisper with automatic fallback and audio preprocessing.
 */

import { InBrowserWhisperProvider } from "./browserWhisper";
import { CloudWhisperProvider, type CloudWhisperConfig } from "./cloudWhisper";
import { LocalWhisperServiceProvider, type LocalWhisperConfig } from "./localWhisper";
import type { TranscriptionEngine, TranscriptionProgress, TranscriptionProvider, TranscriptionResult } from "./types";

export * from "./types";
export * from "./browserWhisper";
export * from "./localWhisper";
export * from "./cloudWhisper";

const defaultBrowserWhisper = new InBrowserWhisperProvider();

let customLocalProvider: LocalWhisperServiceProvider | null = null;
let customCloudProvider: CloudWhisperProvider | null = null;

export function configureLocalWhisper(config: LocalWhisperConfig): void {
  customLocalProvider = new LocalWhisperServiceProvider(config);
}

export function configureCloudWhisper(config: CloudWhisperConfig): void {
  customCloudProvider = new CloudWhisperProvider(config);
}

export function getTranscriptionProvider(engine: TranscriptionEngine = "whisper-browser"): TranscriptionProvider {
  switch (engine) {
    case "whisper-local":
      return customLocalProvider || new LocalWhisperServiceProvider();
    case "whisper-cloud":
      if (!customCloudProvider) {
        throw new Error("Cloud Whisper provider is not configured. Connect an API key in Settings -> AI Connections.");
      }
      return customCloudProvider;
    case "whisper-browser":
    default:
      return defaultBrowserWhisper;
  }
}

/**
 * Transcribes an interview answer audio recording.
 * Automatically checks silence, decodes audio, and invokes the chosen transcription engine.
 */
export async function transcribeAnswerAudio(
  audio: Blob | Float32Array,
  engine: TranscriptionEngine = "whisper-browser",
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: TranscriptionProgress) => void;
  }
): Promise<TranscriptionResult> {
  // Support custom mock transcription function for deterministic E2E testing
  if (typeof window !== "undefined" && typeof (window as any).__CAREEROS_MOCK_TRANSCRIPTION__ === "function") {
    return (window as any).__CAREEROS_MOCK_TRANSCRIPTION__(audio, engine, options);
  }
  const provider = getTranscriptionProvider(engine);
  return provider.transcribe(audio, options);
}
