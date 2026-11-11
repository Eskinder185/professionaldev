import type { AudioStats } from "./model";

/**
 * Microphone level meter. Measures speaking time and pauses from signal level
 * only; no audio leaves the device and nothing is stored.
 */
export type AudioMeter = { stop: () => AudioStats; level: () => number };

export function pausesFromLevels(levels: number[], stepSec: number, threshold: number, minPauseSec = 1.5): AudioStats {
  const pauses: number[] = [];
  let speaking = 0;
  let silentRun = 0;
  let heardSpeech = false;
  for (const level of levels) {
    if (level >= threshold) {
      if (heardSpeech && silentRun * stepSec >= minPauseSec) pauses.push(Math.round(silentRun * stepSec * 10) / 10);
      silentRun = 0;
      heardSpeech = true;
      speaking++;
    } else silentRun++;
  }
  return { speakingSec: Math.round(speaking * stepSec * 10) / 10, pauses, measuredSec: Math.round(levels.length * stepSec * 10) / 10 };
}

export function startAudioMeter(stream: MediaStream, isPaused: () => boolean): AudioMeter | null {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  const context = new Context();
  if (context.state === "suspended") {
    void context.resume().catch(() => undefined);
  }
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);
  const levels: number[] = [];
  let current = 0;
  const step = 0.1;
  const timer = window.setInterval(() => {
    if (isPaused()) return;
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (const value of buffer) sum += value * value;
    current = Math.sqrt(sum / buffer.length);
    levels.push(current);
  }, step * 1000);
  return {
    level: () => current,
    stop: () => {
      window.clearInterval(timer);
      source.disconnect();
      void context.close().catch(() => undefined);
      // Adaptive threshold: well above the quietest tenth of the answer.
      const sorted = [...levels].sort((a, b) => a - b);
      const floor = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
      return pausesFromLevels(levels, step, Math.max(0.012, floor * 3));
    },
  };
}
