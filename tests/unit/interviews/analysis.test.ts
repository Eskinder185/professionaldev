import { describe, expect, it } from "vitest";
import { contentFeedback, speechFeedback, speechMetrics, technicalTerms } from "../../../src/features/interviews/analysis";
import { pausesFromLevels } from "../../../src/features/interviews/audioMeter";
import { defaultConfig } from "../../../src/features/interviews/model";
import { calibrate, presentationObservations, summarize, type PoseSample } from "../../../src/features/interviews/presentation";
import { jobQuestions, pickQuestions } from "../../../src/features/interviews/questions";
import { IT_SUPPORT_JD } from "../../fixtures/jobs";

const prefs = defaultConfig().speech;
const STAR_ANSWER =
  "When I was working at the campus help desk, there was a printer outage before finals. My goal was to restore printing for 300 students. I investigated the print server logs and found a failed driver update, so I rolled it back and documented the fix. As a result, printing was restored in 40 minutes and we avoided the same issue the next term.";

describe("question selection", () => {
  it("returns the requested number of questions deterministically per session", () => {
    const first = pickQuestions("behavioral", "standard", "entry", 3, "seed-1");
    expect(first).toHaveLength(3);
    expect(pickQuestions("behavioral", "standard", "entry", 3, "seed-1")).toEqual(first);
    expect(first.every((question) => question.expectsStar)).toBe(true);
  });

  it("builds job-specific questions from the description's requirements", () => {
    const questions = jobQuestions(IT_SUPPORT_JD, "IT Support Specialist");
    expect(questions.some((question) => /asks for (TCP\/IP|DNS|DHCP|Windows|CompTIA A\+|Communication|Help desk support)/.test(question.text))).toBe(true);
    expect(questions.some((question) => question.text.includes("The role includes"))).toBe(true);
    expect(pickQuestions("job", "standard", "entry", 5, "s", IT_SUPPORT_JD, "IT Support Specialist")).toHaveLength(5);
  });
});

describe("content feedback", () => {
  it("recognizes STAR elements, numbers, and quotes the evidence", () => {
    const items = contentFeedback({ text: STAR_ANSWER }, { expectsStar: true, keywords: ["challenge"], type: "behavioral" });
    const star = items.find((item) => item.text.startsWith("Includes"));
    expect(star?.text).toBe("Includes Situation, Task, Action, Result elements of a STAR answer.");
    expect(star?.evidence).toMatch(/^When I was working/);
    expect(items.find((item) => item.text.includes("concrete number"))?.evidence).toMatch(/300 students|40 minutes/);
    expect(items.some((item) => item.kind === "improvement" && item.text.startsWith("Not clearly present"))).toBe(false);
  });

  it("points out missing structure and short answers without guessing content", () => {
    const items = contentFeedback({ text: "I fixed the printer." }, { expectsStar: true, keywords: ["printer"], type: "behavioral" });
    expect(items.some((item) => item.kind === "improvement" && /4 words/.test(item.text))).toBe(true);
    expect(items.find((item) => item.text.startsWith("Not clearly present"))?.text).toMatch(/Situation, Task, Result/);
  });

  it("handles empty answers honestly", () => {
    expect(contentFeedback({ text: " " }, { expectsStar: true, keywords: [], type: "behavioral" })[0].kind).toBe("note");
  });

  it("detects technical terms and reasoning for technical questions", () => {
    expect(technicalTerms("I used PowerShell and Active Directory, then checked DNS.")).toEqual(expect.arrayContaining(["PowerShell", "Active Directory", "DNS"]));
    const items = contentFeedback({ text: "I checked DNS first because most outages we saw were name resolution problems." }, { expectsStar: false, keywords: ["troubleshoot"], type: "technical" });
    expect(items.some((item) => item.text === "Explains reasoning, not just steps.")).toBe(true);
  });
});

describe("speech metrics", () => {
  it("computes pace, fillers, and pauses, and compares pace to the user's range", () => {
    const text = "Um so I basically reset the account and you know verified the user could sign in again um after that";
    const metrics = speechMetrics(text, 12, { speakingSec: 9, pauses: [1.6, 2.4], measuredSec: 12 }, prefs);
    expect(metrics.words).toBe(20);
    expect(metrics.wpm).toBe(100);
    expect(metrics.fillerCount).toBe(4);
    expect(metrics.fillerBreakdown).toEqual(expect.arrayContaining([{ word: "um", count: 2 }, { word: "you know", count: 1 }, { word: "basically", count: 1 }]));
    expect(metrics.pauses).toBe(2);
    expect(metrics.longestPause).toBe(2.4);
    const feedback = speechFeedback(metrics, prefs, "live");
    expect(feedback[0].text).toMatch(/below your chosen range of 110–170/);
    expect(feedback.some((item) => /approximate/.test(item.text))).toBe(true);
  });

  it("respects preferences and does not apply speech measures to typed answers", () => {
    expect(speechMetrics("um um um", 10, null, { ...prefs, trackFillers: false }).fillerCount).toBe(0);
    expect(speechFeedback(speechMetrics("typed", 10, null, prefs), prefs, "typed")[0].text).toMatch(/Typed answer/);
  });

  it("finds pauses from microphone levels", () => {
    const levels = [...Array(10).fill(0.05), ...Array(20).fill(0.001), ...Array(10).fill(0.05), ...Array(5).fill(0.001)];
    expect(pausesFromLevels(levels, 0.1, 0.01)).toEqual({ speakingSec: 2, pauses: [2], measuredSec: 4.5 });
  });
});

describe("presentation observations", () => {
  const frames = (count: number, make: (i: number) => Partial<PoseSample>, start = 0): PoseSample[] =>
    Array.from({ length: count }, (_, i) => ({ t: start + i * 100, face: true, yaw: 0, pitch: 0, cx: 0.5, cy: 0.45, size: 0.3, ...make(i) }));

  it("calibrates to the user's camera position and counts look-aways", () => {
    const baseline = calibrate(frames(10, () => ({ yaw: 20, pitch: -10 })));
    expect(baseline).toMatchObject({ yaw: 20, pitch: -10 });
    const samples = [...frames(30, () => ({ yaw: 21, pitch: -9 })), ...frames(10, () => ({ yaw: 55 }), 3000), ...frames(20, () => ({ yaw: 19, pitch: -11 }), 4000)];
    const summary = summarize(samples, baseline);
    expect(summary.facingPct).toBe(83);
    expect(summary.lookAways).toBe(1);
    expect(summary.largeMovements).toBeGreaterThanOrEqual(1);
    expect(summary.calibrated).toBe(true);
  });

  it("reports missing faces and framing shifts with qualified language, no confidence score", () => {
    const samples = [...frames(10, () => ({})), ...Array.from({ length: 10 }, (_, i) => ({ t: 1000 + i * 100, face: false })), ...frames(10, () => ({ cx: 0.8 }), 2000)];
    const summary = summarize(samples, null);
    expect(summary.faceVisiblePct).toBe(67);
    const notes = presentationObservations(summary, 30).join(" ");
    expect(notes).toMatch(/detected in about 67%/);
    expect(notes).toMatch(/not a measure of confidence or ability/);
    expect(notes).not.toMatch(/confidence score|nervous|honest|personality/i);
    expect(calibrate([{ t: 0, face: false }])).toBeNull();
  });
});
