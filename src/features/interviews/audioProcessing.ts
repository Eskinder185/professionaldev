/**
 * Audio decoding, resampling, and format conversion utilities for CareerOS transcription.
 */

/**
 * Resamples any multi-channel audio buffer to a 16kHz mono Float32Array.
 */
export function resampleTo16kMono(audioBuffer: {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  getChannelData: (ch: number) => Float32Array;
}): Float32Array {
  const targetSampleRate = 16000;
  const numChannels = audioBuffer.numberOfChannels;
  const originalLength = audioBuffer.length;
  const originalSampleRate = audioBuffer.sampleRate;

  if (originalLength === 0) return new Float32Array(0);

  // Mix down multi-channel audio to mono
  const mono = new Float32Array(originalLength);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < originalLength; i++) {
      mono[i] += channelData[i] / numChannels;
    }
  }

  // If already 16kHz, return mono
  if (originalSampleRate === targetSampleRate) {
    return mono;
  }

  // Linear interpolation resampling to 16kHz
  const targetLength = Math.round((originalLength * targetSampleRate) / originalSampleRate);
  if (targetLength === 0) return new Float32Array(0);

  const resampled = new Float32Array(targetLength);
  const ratio = originalLength / targetLength;

  for (let i = 0; i < targetLength; i++) {
    const originalPos = i * ratio;
    const index1 = Math.floor(originalPos);
    const index2 = Math.min(index1 + 1, originalLength - 1);
    const fraction = originalPos - index1;
    resampled[i] = mono[index1] * (1 - fraction) + mono[index2] * fraction;
  }

  return resampled;
}

/**
 * Decodes an audio blob (WebM, MP4, WAV, OGG, etc.) into a 16kHz mono Float32Array.
 */
export async function decodeAudioBlobTo16kHz(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error("Recorded audio is empty (0 bytes).");
  }

  const AudioContextClass =
    (typeof window !== "undefined" && (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) ||
    null;

  if (!AudioContextClass) {
    throw new Error("Web Audio API AudioContext is not supported in this environment.");
  }

  const audioContext = new AudioContextClass();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return resampleTo16kMono(audioBuffer);
  } finally {
    void audioContext.close().catch(() => undefined);
  }
}

/**
 * Checks whether the audio waveform contains meaningful sound or is essentially pure silence.
 */
export function isAudioSilent(samples: Float32Array, threshold = 0.005): boolean {
  if (samples.length === 0) return true;
  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
    sumSquares += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  return peak < threshold && rms < threshold / 2;
}

/**
 * Encodes a 16kHz mono Float32Array into a standard 16-bit PCM WAV Blob.
 */
export function encodeWavBlob(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");

  // fmt subchunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // 16 for PCM
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // 1 channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * 1 * 16/8)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data subchunk
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
