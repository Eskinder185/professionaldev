/**
 * Audio test fixtures for speech-to-text and audio processing tests.
 */

import { encodeWavBlob } from "../../src/features/interviews/audioProcessing";

/**
 * Generates a Float32Array containing pure silence.
 */
export function generateSilentAudio(durationSec = 2, sampleRate = 16000): Float32Array {
  return new Float32Array(Math.round(durationSec * sampleRate));
}

/**
 * Generates a Float32Array containing a modulated signal resembling speech activity (peaks and pauses).
 */
export function generateSyntheticSpeechAudio(durationSec = 3, sampleRate = 16000): Float32Array {
  const numSamples = Math.round(durationSec * sampleRate);
  const buffer = new Float32Array(numSamples);

  // Combine multiple formant frequencies with a speaking cadence envelope
  const f1 = 300; // fundamental
  const f2 = 800; // formant 1
  const f3 = 2400; // formant 2

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Amplitude envelope simulating spoken syllables (2-3 words per second)
    const envelope = Math.max(0, Math.sin(2 * Math.PI * 2.5 * t)) * 0.4;
    const tone =
      Math.sin(2 * Math.PI * f1 * t) * 0.5 +
      Math.sin(2 * Math.PI * f2 * t) * 0.3 +
      Math.sin(2 * Math.PI * f3 * t) * 0.2;
    buffer[i] = tone * envelope;
  }

  return buffer;
}

/**
 * Generates a WAV Blob of synthetic speech audio for end-to-end tests.
 */
export function generateSpeechWavBlob(durationSec = 2): Blob {
  const samples = generateSyntheticSpeechAudio(durationSec);
  return encodeWavBlob(samples, 16000);
}
