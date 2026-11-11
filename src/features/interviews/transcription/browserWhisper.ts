/**
 * In-browser Whisper speech-to-text using Transformers.js (quantized ONNX running on WebAssembly/WebGPU).
 *
 * Runs 100% locally on the device with zero cloud egress.
 * Automatically cached in the browser's Cache API / IndexedDB after first download (~39MB).
 */

import { decodeAudioBlobTo16kHz, isAudioSilent } from "../audioProcessing";
import type { TranscriptionProgress, TranscriptionProvider, TranscriptionResult, TranscriptionSegment } from "./types";

let pipelinePromise: Promise<any> | null = null;
let pipelineInstance: any = null;

const MODEL_ID = "Xenova/whisper-tiny.en";

async function getOrInitPipeline(onProgress?: (progress: TranscriptionProgress) => void) {
  if (pipelineInstance) return pipelineInstance;
  if (pipelinePromise) return pipelinePromise;

  pipelinePromise = (async () => {
    try {
      const { pipeline, env } = await import("@xenova/transformers");
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      onProgress?.({
        status: "loading-model",
        progress: 10,
        message: "Initializing local Whisper speech model…",
      });

      const pipe = await pipeline("automatic-speech-recognition", MODEL_ID, {
        progress_callback: (item: any) => {
          if (item?.status === "progress" && typeof item?.progress === "number") {
            const pct = Math.min(95, Math.round(item.progress));
            onProgress?.({
              status: "loading-model",
              progress: pct,
              message: `Downloading speech model (${pct}%)…`,
            });
          } else if (item?.status === "done") {
            onProgress?.({
              status: "loading-model",
              progress: 98,
              message: "Loading model into memory…",
            });
          }
        },
      });

      pipelineInstance = pipe;
      onProgress?.({
        status: "ready",
        progress: 100,
        message: "Whisper speech model ready.",
      });
      return pipe;
    } catch (err) {
      pipelinePromise = null;
      throw err;
    }
  })();

  return pipelinePromise;
}

export class InBrowserWhisperProvider implements TranscriptionProvider {
  readonly id = "whisper-browser" as const;
  readonly name = "On-Device Whisper (Local AI)";
  readonly description = "High-accuracy local speech recognition running directly in your browser without cloud servers.";

  async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    if (typeof window === "undefined") {
      return { available: false, reason: "Browser window is unavailable." };
    }
    // Web Audio API is required for audio decoding
    const hasAudio = Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
    if (!hasAudio) {
      return { available: false, reason: "Web Audio API is not supported in this browser." };
    }
    return { available: true };
  }

  async loadModel(onProgress?: (progress: TranscriptionProgress) => void): Promise<void> {
    await getOrInitPipeline(onProgress);
  }

  async transcribe(
    audio: Blob | Float32Array,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: TranscriptionProgress) => void;
      prompt?: string;
    }
  ): Promise<TranscriptionResult> {
    options?.onProgress?.({
      status: "decoding-audio",
      progress: 20,
      message: "Decoding audio waveform…",
    });

    let samples: Float32Array;
    if (audio instanceof Blob) {
      samples = await decodeAudioBlobTo16kHz(audio);
    } else {
      samples = audio;
    }

    const durationSec = Math.round((samples.length / 16000) * 10) / 10;

    // Check for silence or near-zero amplitude
    if (isAudioSilent(samples)) {
      return {
        text: "",
        segments: [],
        durationSec,
        engine: this.id,
        modelName: MODEL_ID,
      };
    }

    if (options?.signal?.aborted) {
      throw new DOMException("Transcription cancelled by user", "AbortError");
    }

    options?.onProgress?.({
      status: "loading-model",
      progress: 40,
      message: "Preparing speech recognizer…",
    });

    const pipe = await getOrInitPipeline(options?.onProgress);

    if (options?.signal?.aborted) {
      throw new DOMException("Transcription cancelled by user", "AbortError");
    }

    options?.onProgress?.({
      status: "transcribing",
      progress: 60,
      message: "Transcribing your answer with on-device Whisper…",
    });

    // Run inference with chunking and timestamp support
    const output = await pipe(samples, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: "english",
      task: "transcribe",
      return_timestamps: true,
    });

    const rawText = (output?.text || "").trim();

    const segments: TranscriptionSegment[] = [];
    if (Array.isArray(output?.chunks) && output.chunks.length > 0) {
      for (const chunk of output.chunks) {
        const text = (chunk?.text || "").trim();
        if (!text) continue;
        const start = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] ?? 0 : 0;
        segments.push({
          t: Math.round(start * 10) / 10,
          text,
        });
      }
    } else if (rawText) {
      segments.push({ t: 0, text: rawText });
    }

    options?.onProgress?.({
      status: "ready",
      progress: 100,
      message: "Transcription complete.",
    });

    return {
      text: rawText,
      segments,
      durationSec,
      engine: this.id,
      modelName: MODEL_ID,
    };
  }

  dispose(): void {
    pipelineInstance = null;
    pipelinePromise = null;
  }
}
