import { analyzeJob } from "../resume/job/requirements";
import { matchResume, type MatchGroup, type RequirementMatch } from "../resume/job/match";
import type { ResumeVersion } from "../resume/model/types";
import { extractGlance, type Glance } from "./text";
import type { JobPosting, JobStoreState } from "./schema";

/**
 * Evidence-based match between a posting and a résumé version, using the same deterministic engine
 * as Résumé Studio and AutoApply. No AI is involved and no score exists without a description.
 */
export interface PostingAnalysis {
  postingId: string;
  versionId: string;
  versionName: string;
  score: number;
  matches: RequirementMatch[];
  counts: Record<MatchGroup, number>;
  /** Share of scored requirements the résumé supports with evidence (0–100), with its basis. */
  coverage: { supported: number; total: number; percent: number };
  glance: Glance;
}

/** The text analysed: description plus any skills the user typed for a manually added job. */
export function analysisText(p: JobPosting): string {
  return [p.description, p.requirements.join("\n"), p.skills.length ? `Skills: ${p.skills.join(", ")}` : ""].filter(Boolean).join("\n");
}

export function analyzePosting(p: JobPosting, version: ResumeVersion | undefined): PostingAnalysis | null {
  const text = analysisText(p);
  if (!version || text.trim().length < 16) return null;
  const job = analyzeJob({ title: p.title, company: p.company, description: text, requirements: [] });
  if (!job.requirements.some((r) => r.selected)) return null;
  const result = matchResume(version.resume, job.requirements, version.settings, 1);
  const total = result.requiredCoverage.total + result.preferredCoverage.total;
  const supported = result.requiredCoverage.met + result.preferredCoverage.met;
  return {
    postingId: p.id,
    versionId: version.id,
    versionName: version.name,
    score: result.score,
    matches: result.matches,
    counts: result.counts,
    coverage: { supported, total, percent: total ? Math.round((supported / total) * 100) : 0 },
    glance: extractGlance(p),
  };
}

export const GROUP_COPY: Record<MatchGroup, { label: string; hint: string }> = {
  matched: { label: "Matched", hint: "Your résumé shows this in your experience." },
  strengthen: { label: "Partially demonstrated", hint: "Mentioned, but with little supporting experience." },
  missing: { label: "Missing", hint: "Not found anywhere in the résumé." },
  review: { label: "Needs confirmation", hint: "Can’t be judged automatically. Confirm it yourself." },
};

/** Ranks by evidence, then nudges by explicit "more/less like this" feedback. Returns reasons for display. */
export function rankPostings(
  state: JobStoreState,
  postings: JobPosting[],
  version: ResumeVersion | undefined,
  now = Date.now(),
): Map<string, { score: number; analysis: PostingAnalysis | null; reasons: string[] }> {
  const likedPostings = state.feedback.liked.map((id) => state.postings[id]).filter(Boolean);
  const dislikedPostings = state.feedback.disliked.map((id) => state.postings[id]).filter(Boolean);
  const out = new Map<string, { score: number; analysis: PostingAnalysis | null; reasons: string[] }>();
  for (const p of postings) {
    const analysis = analyzePosting(p, version);
    const reasons: string[] = [];
    let score = analysis?.score ?? 0;
    if (analysis) {
      const top = analysis.matches.filter((m) => m.group === "matched").slice(0, 3).map((m) => m.requirement.term);
      if (top.length) reasons.push(`Your résumé supports ${top.join(", ")}`);
    } else {
      reasons.push("No analysis yet: the posting has too little text to compare");
    }
    const sim = (a: JobPosting) => (a.company === p.company ? 1 : 0) + (a.category && a.category === p.category ? 1 : 0);
    const up = likedPostings.reduce((n, a) => n + sim(a), 0);
    const down = dislikedPostings.reduce((n, a) => n + sim(a), 0);
    if (up) { score += Math.min(10, up * 4); reasons.push("Similar to jobs you asked for more of"); }
    if (down) { score -= Math.min(15, down * 6); reasons.push("Similar to jobs you asked for less of"); }
    const prefs = state.prefs;
    const words = (v: string) => v.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
    const hay = `${p.title} ${p.description}`.toLowerCase();
    const hits = words(prefs.include).filter((w) => hay.includes(w));
    if (hits.length) { score += Math.min(10, hits.length * 3); reasons.push(`Mentions ${hits.slice(0, 3).join(", ")} from your preferences`); }
    if (prefs.arrangements.length && prefs.arrangements.includes(p.workArrangement)) { score += 5; reasons.push(`${p.workArrangement === "remote" ? "Remote" : p.workArrangement === "hybrid" ? "Hybrid" : "On-site"}, as you prefer`); }
    void now;
    out.set(p.id, { score: Math.max(0, Math.min(100, score)), analysis, reasons });
  }
  return out;
}
