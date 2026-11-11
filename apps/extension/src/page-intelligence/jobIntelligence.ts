import { extractRequirements } from "../../../../src/features/resume/job/extractRequirements";
import type { JobConfidence, JobIntelligence, JobPageInfo, PageRequirement, PlatformId } from "../../../../packages/careeros-shared/types";
import type { DescriptionResult } from "./jobDescription";

/**
 * Turns what was read from a page into a validated description of the job.
 *
 * - Confidence says how sure we are this is really a job posting. Structured data from the site
 *   itself, or a known applicant system, is trusted; an ordinary page with a heading is not.
 * - Requirements come from the job description only, each with the sentence it came from.
 * - Nothing is invented: a missing field stays missing, and a thin description is reported as
 *   "not enough information" instead of being scored.
 */

export const MIN_DESCRIPTION_CHARS = 300;
export const MIN_SCORED_REQUIREMENTS = 3;
export const NOT_ENOUGH_INFO = "Not enough job information to calculate a reliable match.";

/** Categories that describe the work, not a skill the résumé must show. */
const UNSCORED_CATEGORIES = new Set(["Responsibilities", "Other technical terms"]);

export function jobConfidence(job: JobPageInfo, platform: PlatformId, hasForm: boolean, description: DescriptionResult | null): { level: JobConfidence; reasons: string[] } {
  const reasons: string[] = [];
  const structured = Object.values(job.sources).some((source) => /JSON-LD/i.test(source));
  const knownSystem = platform !== "generic" && platform !== "unsupported";
  if (structured) reasons.push("The page’s own structured data describes this job.");
  if (knownSystem) reasons.push("This is a supported employer application system.");
  if (hasForm) reasons.push("The page has an application form.");
  if (description) reasons.push(`A job description was found (${description.source}).`);
  if (!job.company) reasons.push("The company name wasn’t found on the page.");

  if (structured && job.title) return { level: "high", reasons };
  if (knownSystem && job.title && (hasForm || description)) return { level: "high", reasons };
  if ((knownSystem && job.title) || (hasForm && job.title && (job.company || description))) return { level: "medium", reasons };
  reasons.push("There isn’t enough on the page to be sure this is a job posting.");
  return { level: "low", reasons };
}

export function buildJobIntelligence(job: JobPageInfo, platform: PlatformId, hasForm: boolean, description: DescriptionResult | null): JobIntelligence {
  const text = job.description || description?.text || "";
  const source = job.description ? Object.values(job.sources).find((s) => /JSON-LD/i.test(s)) ?? "JSON-LD JobPosting" : (description?.source ?? "");
  const { level, reasons } = jobConfidence(job, platform, hasForm, description ?? (job.description ? { text: job.description, source, truncated: false } : null));

  const requirements: PageRequirement[] = text
    ? extractRequirements(text).requirements.map((item) => ({
        term: item.term,
        kind: item.kind,
        category: item.category,
        evidence: item.snippets[Math.max(0, (item.snippetKinds ?? []).indexOf(item.kind))] ?? item.phrases[0] ?? "",
        uncertain: Boolean(item.uncertain),
      }))
    : [];

  const scored = requirements.filter((r) => (r.kind === "required" || r.kind === "preferred") && !r.uncertain && !UNSCORED_CATEGORIES.has(r.category));
  let insufficiencyReason: string | null = null;
  if (level === "low") insufficiencyReason = "CareerOS isn’t sure this page is a job posting.";
  else if (text.length < MIN_DESCRIPTION_CHARS) insufficiencyReason = "The job description on this page is too short or couldn’t be read.";
  else if (scored.length < MIN_SCORED_REQUIREMENTS) insufficiencyReason = "The description doesn’t list enough specific requirements to compare.";

  return {
    confidence: level,
    confidenceReasons: reasons,
    descriptionSource: source,
    descriptionChars: text.length,
    requirements,
    sufficientForMatch: insufficiencyReason === null,
    insufficiencyReason: insufficiencyReason === null ? null : `${NOT_ENOUGH_INFO} ${insufficiencyReason}`,
  };
}

/** Requirements that count toward a match estimate: specific, confident, and about the person's skills. */
export const scoredRequirements = (intelligence: JobIntelligence): PageRequirement[] =>
  intelligence.requirements.filter((r) => (r.kind === "required" || r.kind === "preferred") && !r.uncertain && !UNSCORED_CATEGORIES.has(r.category));
