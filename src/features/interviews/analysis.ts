import { TAXONOMY, termRegex } from "../resume/job/taxonomy";
import type { Answer, AudioStats, SpeechPreferences } from "./model";
import type { Question } from "./questions";

/**
 * Rule-based answer feedback computed in the browser from the transcript and
 * audio-level measurements. No AI service is involved. Every observation
 * points at something measurable in the answer.
 *
 * Speech measures (pace, pauses, filler words) describe patterns only. They
 * are compared with the user's own preferences and are never treated as a
 * measure of competence; accents and speech differences are not evaluated.
 */

export type FeedbackItem = { kind: "strength" | "improvement" | "note"; text: string; evidence?: string };

export type SpeechMetrics = {
  words: number;
  wpm: number | null;
  fillerCount: number;
  fillersPer100: number | null;
  fillerBreakdown: Array<{ word: string; count: number }>;
  pauses: number;
  longestPause: number;
  speakingRatio: number | null;
};

const sentences = (text: string) => text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

const STAR: Array<{ part: "Situation" | "Task" | "Action" | "Result"; cue: RegExp }> = [
  { part: "Situation", cue: /\b(when i was|while (?:i was )?working|at my (?:last |previous )?(?:job|role|company)|in my role|there was a|we had a|the situation|during (?:a|my|our)|last (?:year|month|semester)|at the time)\b/i },
  { part: "Task", cue: /\b(my (?:task|goal|job|role|responsibility) was|i (?:needed|had) to|i was (?:asked|responsible|tasked)|the goal was|we needed to|i wanted to)\b/i },
  { part: "Action", cue: /\bi (?:built|created|wrote|led|organized|set up|configured|reviewed|analy[sz]ed|talked|met|called|decided|proposed|designed|tested|fixed|investigated|documented|trained|contacted|scheduled|automated|implemented|researched|asked|started|changed|used|worked with)\b/i },
  { part: "Result", cue: /\b(as a result|the result|resulted in|which (?:led|reduced|improved|saved|increased|meant)|ended up|in the end|outcome|we (?:finished|delivered|launched|reduced|improved|saved)|reduced|improved|increased|saved|\d+\s?%|percent)\b/i },
];

const ALL_TERMS = Object.values(TAXONOMY).flatMap((entries) => entries.map(([term, aliases = []]) => ({ term, spellings: [term, ...aliases] })));

export function technicalTerms(text: string): string[] {
  return ALL_TERMS.filter(({ spellings }) => spellings.some((spelling) => spelling.length > 2 && termRegex(spelling, "").test(text))).map(({ term }) => term);
}

export function speechMetrics(text: string, durationSec: number, audio: AudioStats | null, preferences: SpeechPreferences): SpeechMetrics {
  const words = wordCount(text);
  const lower = ` ${text.toLowerCase().replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ")} `;
  const fillerBreakdown = preferences.trackFillers
    ? preferences.fillers
        .map((word) => ({ word, count: lower.split(` ${word.toLowerCase()} `).length - 1 }))
        .filter((item) => item.count > 0)
    : [];
  const fillerCount = fillerBreakdown.reduce((sum, item) => sum + item.count, 0);
  const pauses = audio?.pauses ?? [];
  return {
    words,
    wpm: durationSec >= 5 && words ? Math.round(words / (durationSec / 60)) : null,
    fillerCount,
    fillersPer100: words >= 20 && preferences.trackFillers ? Math.round((fillerCount / words) * 1000) / 10 : null,
    fillerBreakdown,
    pauses: pauses.length,
    longestPause: pauses.length ? Math.round(Math.max(...pauses) * 10) / 10 : 0,
    speakingRatio: audio && audio.measuredSec > 0 ? Math.round((audio.speakingSec / audio.measuredSec) * 100) : null,
  };
}

export function contentFeedback(answer: Pick<Answer, "text">, question: Pick<Question, "expectsStar" | "keywords" | "type">, jobTerms: string[] = []): FeedbackItem[] {
  const text = answer.text.trim();
  const items: FeedbackItem[] = [];
  const words = wordCount(text);
  if (!words) return [{ kind: "note", text: "No answer text was recorded for this question, so content feedback isn't available. Add a transcript or notes to review it." }];
  const parts = sentences(text);

  if (words < 40) items.push({ kind: "improvement", text: `This answer is ${words} words. Most interview answers need a little more detail: context, what you did, and what happened.` });
  else if (words > 400) items.push({ kind: "improvement", text: `This answer is ${words} words. Consider tightening it to the most relevant points; long answers can lose the listener.` });
  else items.push({ kind: "strength", text: `A workable length (${words} words).` });

  if (question.expectsStar) {
    const found = STAR.map(({ part, cue }) => ({ part, sentence: parts.find((sentence) => cue.test(sentence)) }));
    const present = found.filter((item) => item.sentence);
    const missing = found.filter((item) => !item.sentence).map((item) => item.part);
    if (present.length) items.push({ kind: "strength", text: `Includes ${present.map((item) => item.part).join(", ")} elements of a STAR answer.`, evidence: present[0].sentence });
    if (missing.length) items.push({ kind: "improvement", text: `Not clearly present: ${missing.join(", ")}. ${missing.includes("Result") ? "Close with what changed because of your actions." : missing.includes("Action") ? "Say specifically what you did, using “I”." : "Briefly set up the context before the details."}` });
  }

  const metric = parts.find((sentence) => /\b\d+(?:[.,]\d+)?\s?(?:%|percent|hours?|days?|weeks?|users?|tickets?|people|customers|minutes|x\b)|\$\s?\d/i.test(sentence));
  if (metric) items.push({ kind: "strength", text: "Uses a concrete number to show scale or impact.", evidence: metric });
  else items.push({ kind: "improvement", text: "No measurable detail (a number, time saved, people helped). Add one if you have it; don't estimate what you don't know." });

  const example = parts.find((sentence) => /\b(for example|for instance|one time|specifically|in one case)\b/i.test(sentence));
  if (example) items.push({ kind: "strength", text: "Signals a specific example.", evidence: example });

  const keywordHits = question.keywords.filter((keyword) => text.toLowerCase().includes(keyword));
  if (question.keywords.length && keywordHits.length === 0) items.push({ kind: "improvement", text: "The answer doesn't use any of the question's key words. Check that it addresses what was asked." });

  const terms = technicalTerms(text);
  if (question.type === "technical" || question.type === "job") {
    if (terms.length) items.push({ kind: "strength", text: `Names specific tools or concepts: ${terms.slice(0, 6).join(", ")}.` });
    const reasoning = parts.find((sentence) => /\b(because|so that|which means|the reason|trade-?off|instead of)\b/i.test(sentence));
    if (reasoning) items.push({ kind: "strength", text: "Explains reasoning, not just steps.", evidence: reasoning });
    else items.push({ kind: "improvement", text: "Add why you chose an approach (“because…”, “the trade-off was…”), not just what you did." });
  }

  if (jobTerms.length) {
    const mentioned = jobTerms.filter((term) => termRegex(term, "").test(text));
    if (mentioned.length) items.push({ kind: "strength", text: `Connects to the job description: ${mentioned.slice(0, 5).join(", ")}.` });
  }
  return items;
}

export function speechFeedback(metrics: SpeechMetrics, preferences: SpeechPreferences, transcriptSource: Answer["transcriptSource"]): FeedbackItem[] {
  const items: FeedbackItem[] = [];
  if (transcriptSource === "typed") return [{ kind: "note", text: "Typed answer: speaking pace and filler words don't apply." }];
  if (metrics.wpm !== null) {
    const { paceMin, paceMax } = preferences;
    if (metrics.wpm < paceMin) items.push({ kind: "note", text: `Average pace was about ${metrics.wpm} words per minute, below your chosen range of ${paceMin}–${paceMax}. Pauses for thought are normal; adjust the range in settings if it doesn't suit you.` });
    else if (metrics.wpm > paceMax) items.push({ kind: "note", text: `Average pace was about ${metrics.wpm} words per minute, above your chosen range of ${paceMin}–${paceMax}. A brief pause between points can help listeners follow.` });
    else items.push({ kind: "strength", text: `Average pace was about ${metrics.wpm} words per minute, within your chosen range.` });
  } else items.push({ kind: "note", text: "Pace isn't shown: the answer was too short or had no transcript." });
  if (metrics.fillersPer100 !== null) {
    const list = metrics.fillerBreakdown.map((item) => `“${item.word}” ×${item.count}`).join(", ");
    items.push(metrics.fillersPer100 > 4 ? { kind: "note", text: `${metrics.fillerCount} filler words (${metrics.fillersPer100} per 100 words): ${list}. Only words the transcript captured are counted.` } : { kind: "strength", text: metrics.fillerCount ? `Few filler words (${list}).` : "No tracked filler words in the transcript." });
  }
  if (metrics.pauses) items.push({ kind: "note", text: `${metrics.pauses} pause${metrics.pauses === 1 ? "" : "s"} of 1.5 seconds or longer (longest about ${metrics.longestPause}s), measured from microphone level.` });
  items.push({ kind: "note", text: "Transcription can miss words, especially with background noise, accents, or technical terms. Treat these numbers as approximate." });
  return items;
}

