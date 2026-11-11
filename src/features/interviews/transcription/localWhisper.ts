/**
 * Local Whisper Service provider for CareerOS Interview Studio.
 *
 * Connects to a trusted local Whisper transcription server (such as faster-whisper,
 * whisper.cpp server, or OpenAI-compatible local audio endpoint running on 127.0.0.1:8080 or custom port).
 */

import { decodeAudioBlobTo16kHz, encodeWavBlob, isAudioSilent } from "../audioProcessing";
import type { TranscriptionProgress, TranscriptionProvider, TranscriptionResult, TranscriptionSegment } from "./types";

export interface LocalWhisperConfig {
  baseUrl: string;
  model?: string;
  apiKey?: string;
}

export class LocalWhisperServiceProvider implements TranscriptionProvider {
  readonly id = "whisper-local" as const;
  readonly name = "Local Whisper Server";
  readonly description = "External local Whisper companion (faster-whisper / whisper.cpp) on 127.0.0.1.";

  private config: LocalWhisperConfig;

  constructor(config: LocalWhisperConfig = { baseUrl: "http://127.0.0.1:8080/v1" }) {
    this.config = config;
  }

  async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    try {
      const url = this.config.baseUrl.replace(/\/+$/, "");
      const res = await fetch(`${url}/models`, {
        method: "GET",
        headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
      });
      if (res.ok) {
        return { available: true };
      }
      return { available: false, reason: `Local Whisper service returned status ${res.status}.` };
    } catch {
      return {
        available: false,
        reason: `Could not connect to local Whisper server at ${this.config.baseUrl}.`,
      };
    }
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
      message: "Processing audio for local Whisper server…",
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
        modelName: this.config.model || "whisper-local",
      };
    }

    options?.onProgress?.({
      status: "transcribing",
      progress: 50,
      message: "Sending audio to local Whisper server…",
    });

    const formData = new FormData();
    formData.append("file", wavBlob, "answer.wav");
    formData.append("model", this.config.model || "whisper-1");
    formData.append("response_format", "verbose_json");

    const endpoint = `${this.config.baseUrl.replace(/\/+$/, "")}/audio/transcriptions`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
      body: formData,
      signal: options?.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Local Whisper service error (${res.status}): ${errText || res.statusText}`);
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
      modelName: this.config.model || "whisper-local",
    };
  }
}
