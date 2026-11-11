import type { PresentationSummary } from "./model";

/**
 * Presentation observations from approximate webcam head-pose estimates.
 *
 * These are coaching observations about framing and head direction only.
 * They do not measure confidence, emotion, personality, truthfulness, or
 * employability, and webcam estimates are noisy: every message is qualified.
 */

export type PoseSample = { t: number; face: boolean; yaw?: number; pitch?: number; cx?: number; cy?: number; size?: number };
export type Baseline = { yaw: number; pitch: number; cx: number; cy: number; size: number };

export const THRESHOLDS = { yaw: 18, pitch: 14, lookAwayMs: 700, movementDeg: 25, movementWindowMs: 500, framingOffset: 0.15, framingSize: 0.35 };

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : 0;
};

/** Baseline from samples captured while the user looks at the camera; null if too few faces. */
export function calibrate(samples: PoseSample[]): Baseline | null {
  const faces = samples.filter((sample) => sample.face && sample.yaw !== undefined);
  if (faces.length < 5) return null;
  return {
    yaw: median(faces.map((sample) => sample.yaw!)),
    pitch: median(faces.map((sample) => sample.pitch!)),
    cx: median(faces.map((sample) => sample.cx ?? 0.5)),
    cy: median(faces.map((sample) => sample.cy ?? 0.5)),
    size: median(faces.map((sample) => sample.size ?? 0.3)),
  };
}

const facing = (sample: PoseSample, baseline: Baseline) =>
  sample.face && Math.abs((sample.yaw ?? 0) - baseline.yaw) <= THRESHOLDS.yaw && Math.abs((sample.pitch ?? 0) - baseline.pitch) <= THRESHOLDS.pitch;

export function summarize(samples: PoseSample[], calibration: Baseline | null): PresentationSummary {
  const baseline = calibration ?? { yaw: 0, pitch: 0, cx: 0.5, cy: 0.5, size: 0.3 };
  const visible = samples.filter((sample) => sample.face);
  const facingCount = visible.filter((sample) => facing(sample, baseline)).length;

  // Look-aways: not facing (or face lost) for at least lookAwayMs, counted once per episode.
  let lookAways = 0;
  let awaySince: number | null = null;
  let counted = false;
  for (const sample of samples) {
    if (facing(sample, baseline)) {
      awaySince = null;
      counted = false;
    } else {
      awaySince ??= sample.t;
      if (!counted && sample.t - awaySince >= THRESHOLDS.lookAwayMs) {
        lookAways++;
        counted = true;
      }
    }
  }

  // Large movements: orientation change above movementDeg within a short window; 1 s cool-down.
  let largeMovements = 0;
  let lastCounted = -Infinity;
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length && visible[j].t - visible[i].t <= THRESHOLDS.movementWindowMs; j++) {
      const delta = Math.hypot((visible[j].yaw ?? 0) - (visible[i].yaw ?? 0), (visible[j].pitch ?? 0) - (visible[i].pitch ?? 0));
      if (delta > THRESHOLDS.movementDeg && visible[j].t - lastCounted > 1000) {
        largeMovements++;
        lastCounted = visible[j].t;
        break;
      }
    }
  }

  const shifted = visible.filter(
    (sample) => Math.hypot((sample.cx ?? 0.5) - baseline.cx, (sample.cy ?? 0.5) - baseline.cy) > THRESHOLDS.framingOffset || Math.abs((sample.size ?? baseline.size) - baseline.size) / baseline.size > THRESHOLDS.framingSize,
  ).length;

  return {
    samples: samples.length,
    faceVisiblePct: samples.length ? Math.round((visible.length / samples.length) * 100) : 0,
    facingPct: visible.length ? Math.round((facingCount / visible.length) * 100) : 0,
    lookAways,
    largeMovements,
    framingShiftPct: visible.length ? Math.round((shifted / visible.length) * 100) : 0,
    calibrated: Boolean(calibration),
  };
}

/** Qualified, observable statements. No confidence score, no trait inferences. */
export function presentationObservations(summary: PresentationSummary, durationSec: number): string[] {
  if (summary.samples < 10) return ["Not enough camera frames were analyzed for this answer to describe framing or head direction."];
  const notes: string[] = [];
  if (summary.faceVisiblePct < 70) notes.push(`Your face was detected in about ${summary.faceVisiblePct}% of analyzed frames. Check lighting and that the camera shows your whole face.`);
  else notes.push(`Your face was detected in about ${summary.faceVisiblePct}% of analyzed frames.`);
  if (summary.facingPct >= 75) notes.push(`You appeared to face approximately toward the camera for most of this response (about ${summary.facingPct}% of frames with a face).`);
  else notes.push(`You appeared to face toward the camera in about ${summary.facingPct}% of frames with a face. ${summary.calibrated ? "" : "Calibrating with your usual camera position can make this more accurate. "}Looking at the lens from time to time can feel more like eye contact to an interviewer.`);
  if (summary.lookAways) notes.push(`There were about ${summary.lookAways} longer look-aways (around a second or more). Glancing away while thinking is normal.`);
  const perMinute = durationSec > 0 ? summary.largeMovements / (durationSec / 60) : 0;
  if (perMinute > 4) notes.push(`There were frequent large head-direction changes (about ${summary.largeMovements} in this answer).`);
  if (summary.framingShiftPct > 30) notes.push(`Your position in the frame shifted noticeably in about ${summary.framingShiftPct}% of frames. A stable seat and a camera near eye level help keep framing consistent.`);
  if (!summary.calibrated) notes.push("Estimates assume the camera is straight in front of you. If it sits to the side or below your eyes, calibrate before answering.");
  notes.push("These are approximate webcam estimates of framing and head direction, not a measure of confidence or ability.");
  return notes;
}
