/**
 * Optional Cloud Whisper Transcription Provider (OpenAI / Groq / custom OpenAI-compatible cloud).
 *
 * ONLY active when the user explicitly configures an API key and allows cloud transcription.
 */

import { decodeAudioBlobTo16kHz, encodeWavBlob, isAudioSilent } from "../audioProcessing";
import type { TranscriptionProgress, TranscriptionProvider, TranscriptionResult, TranscriptionSegment } from "./types";

export interface CloudWhisperConfig {
  baseUrl: string;
  apiKey: string;
  model?: string;
}

export class CloudWhisperProvider implements TranscriptionProvider {
  readonly id = "whisper-cloud" as const;
  readonly name = "Cloud Whisper API";
  readonly description = "Fast cloud speech recognition via configured OpenAI/Groq API.";

  private config: CloudWhisperConfig;

  constructor(config: CloudWhisperConfig) {
    this.config = config;
  }

  async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    if (!this.config.apiKey) {
      return { available: false, reason: "No API key configured for cloud transcription." };
    }
    return { available: true };
  }

  async transcribe(
    audio: Blob | Float32Array,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: TranscriptionProgress) => void;
    }
  ): Promise<TranscriptionResult> {
    options?.onProgress?.({
      status: "decoding-audio",
      progress: 20,
      message: "Preparing audio waveform…",
    });

    let samples: Float32Array;
    let wavBlob: Blob;

    if (audio instanceof Blob) {
      samples = await decodeAudioBlobTo16kHz(audio);
      wavBlob = encodeWavBlob(samples, 16000);
    } else {
      samples = audio;
      wavBlob = encodeWavBlob(samples, 16000);
    }

    const durationSec = Math.round((samples.length / 16000) * 10) / 10;

    if (isAudioSilent(samples)) {
      return {
        text: "",
        segments: [],
        durationSec,
        engine: this.id,
        modelName: this.config.model || "whisper-1",
      };
    }

    options?.onProgress?.({
      status: "transcribing",
      progress: 50,
      message: "Transcribing with Cloud Whisper…",
    });

    const formData = new FormData();
    formData.append("file", wavBlob, "answer.wav");
    formData.append("model", this.config.model || "whisper-1");
    formData.append("response_format", "verbose_json");

    const endpoint = `${this.config.baseUrl.replace(/\/+$/, "")}/audio/transcriptions`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: formData,
      signal: options?.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Cloud Whisper error (${res.status}): ${errText || res.statusText}`);
    }

    const json = await res.json();
    const rawText = (json.text || "").trim();

    const segments: TranscriptionSegment[] = [];
    if (Array.isArray(json.segments) && json.segments.length > 0) {
      for (const seg of json.segments) {
        const text = (seg.text || "").trim();
        if (!text) continue;
        segments.push({
          t: Math.round((seg.start ?? 0) * 10) / 10,
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
      modelName: this.config.model || "whisper-1",
    };
  }
}
