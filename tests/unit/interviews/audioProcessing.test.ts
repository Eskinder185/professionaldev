import { describe, expect, it } from "vitest";
import { encodeWavBlob, isAudioSilent, resampleTo16kMono } from "../../../src/features/interviews/audioProcessing";
import { generateSilentAudio, generateSyntheticSpeechAudio } from "../../fixtures/audio";

describe("audio processing and format conversion", () => {
  it("detects silent audio accurately", () => {
    const silent = generateSilentAudio(2);
    expect(isAudioSilent(silent)).toBe(true);

    const empty = new Float32Array(0);
    expect(isAudioSilent(empty)).toBe(true);

    const nearZero = new Float32Array(1000).fill(0.0001);
    expect(isAudioSilent(nearZero)).toBe(true);
  });

  it("identifies active speech audio as non-silent", () => {
    const speech = generateSyntheticSpeechAudio(2);
    expect(isAudioSilent(speech)).toBe(false);
  });

  it("resamples stereo 48kHz to mono 16kHz accurately", () => {
    const originalRate = 48000;
    const durationSec = 1.5;
    const originalLength = Math.round(durationSec * originalRate);

    const left = new Float32Array(originalLength);
    const right = new Float32Array(originalLength);
    for (let i = 0; i < originalLength; i++) {
      left[i] = Math.sin(2 * Math.PI * 440 * (i / originalRate)) * 0.5;
      right[i] = Math.sin(2 * Math.PI * 880 * (i / originalRate)) * 0.5;
    }

    const mockBuffer = {
      numberOfChannels: 2,
      length: originalLength,
      sampleRate: originalRate,
      getChannelData: (ch: number) => (ch === 0 ? left : right),
    };

    const resampled = resampleTo16kMono(mockBuffer);
    const expectedLength = Math.round(durationSec * 16000);
    expect(resampled.length).toBe(expectedLength);
    expect(isAudioSilent(resampled)).toBe(false);
  });

  it("passes 16kHz mono audio through without unnecessary interpolation", () => {
    const speech = generateSyntheticSpeechAudio(1, 16000);
    const mockBuffer = {
      numberOfChannels: 1,
      length: speech.length,
      sampleRate: 16000,
      getChannelData: () => speech,
    };

    const output = resampleTo16kMono(mockBuffer);
    expect(output.length).toBe(speech.length);
    expect(output[100]).toBeCloseTo(speech[100], 5);
  });

  it("encodes valid 16kHz 16-bit PCM WAV blobs", async () => {
    const samples = generateSyntheticSpeechAudio(1, 16000);
    const blob = encodeWavBlob(samples, 16000);

    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + samples.length * 2);

    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);

    // RIFF check
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(riff).toBe("RIFF");

    // WAVE check
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(wave).toBe("WAVE");

    // Channels check (mono = 1)
    expect(view.getUint16(22, true)).toBe(1);

    // Sample rate check (16000)
    expect(view.getUint32(24, true)).toBe(16000);

    // Bits per sample check (16)
    expect(view.getUint16(34, true)).toBe(16);
  });
});
