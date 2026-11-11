/**
 * Transcription types and provider contracts for CareerOS Interview Studio.
 */

export type TranscriptionEngine =
  | "whisper-browser"
  | "whisper-local"
  | "whisper-cloud"
  | "browser-live";

export interface TranscriptionSegment {
  t: number;
  text: string;
}

export interface TranscriptionProgress {
  status: "idle" | "loading-model" | "decoding-audio" | "transcribing" | "ready" | "error";
  progress?: number; // 0 to 100
  message?: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  durationSec: number;
  engine: TranscriptionEngine;
  modelName?: string;
}

export interface TranscriptionProvider {
  readonly id: TranscriptionEngine;
  readonly name: string;
  readonly description: string;
  isAvailable(): Promise<{ available: boolean; reason?: string }>;
  loadModel?(onProgress?: (progress: TranscriptionProgress) => void): Promise<void>;
  transcribe(
    audio: Blob | Float32Array,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: TranscriptionProgress) => void;
      prompt?: string;
    }
  ): Promise<TranscriptionResult>;
  cancel?(): void;
  dispose?(): void;
}
