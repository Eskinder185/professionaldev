import { matchResume } from "../../../../src/features/resume/job/match";
import { defaultSettings, emptyResume } from "../../../../src/features/resume/model/defaults";
import type { Requirement, Resume } from "../../../../src/features/resume/model/types";
import type { JobIntelligence, SharedProfileSubset } from "../../../../packages/careeros-shared/types";
import { NOT_ENOUGH_INFO, scoredRequirements } from "./jobIntelligence";

/**
 * A live, in-panel estimate of how well the person's approved profile matches the job on the page.
 * It reuses CareerOS's own rule-based matching engine. It is an internal estimate of résumé and
 * job-description overlap, not an applicant-tracking-system score, and it never sees anything the
 * person did not approve for sharing.
 */

export type LiveStatus = "matched" | "partial" | "missing" | "uncertain";

export interface LiveRequirementResult {
  term: string;
  kind: "required" | "preferred";
  status: LiveStatus;
  rationale: string;
  /** What in the profile supports it (empty when missing). */
  evidence: string[];
  /** The job-description sentence that mentions it. */
  jobEvidence: string;
}

export type LiveMatch =
  | { ready: false; reason: string }
  | { ready: true; percent: number; results: LiveRequirementResult[]; counts: Record<LiveStatus, number>; note: string };

export const ESTIMATE_NOTE = "An internal estimate of how your approved profile overlaps this job description. It is not an ATS score and no employer sees it.";

/** Builds a résumé from what the person approved for the extension. Nothing is invented. */
export function resumeFromProfile(profile: SharedProfileSubset | null | undefined): Resume {
  const resume = emptyResume();
  if (!profile) return resume;
  resume.contact.name = [profile.values.firstName, profile.values.lastName].filter(Boolean).join(" ");
  resume.skills = profile.skills?.length ? [{ id: "skills", name: "Skills", skills: profile.skills }] : [];
  resume.experience = (profile.experience ?? []).map((item, index) => ({ id: `exp-${index}`, title: item.title, employer: item.employer, location: item.location, startDate: item.startDate, endDate: item.endDate, current: item.current, bullets: item.bullets ?? [] }));
  resume.education = (profile.education ?? []).map((item, index) => ({ id: `edu-${index}`, institution: item.institution, degree: item.degree, field: item.field, location: item.location, startDate: item.startDate, endDate: item.endDate, gpa: "", details: [] }));
  resume.certifications = (profile.certifications ?? []).map((name, index) => ({ id: `cert-${index}`, name, issuer: "", date: "", credentialId: "" }));
  return resume;
}

export const profileHasEvidence = (profile: SharedProfileSubset | null | undefined): boolean =>
  Boolean(profile && ((profile.skills?.length ?? 0) || (profile.experience?.length ?? 0) || (profile.certifications?.length ?? 0) || (profile.education?.length ?? 0)));

const STATUS: Record<string, LiveStatus> = { matched: "matched", strengthen: "partial", missing: "missing", review: "uncertain" };

export function computeLiveMatch(intelligence: JobIntelligence | null | undefined, profile: SharedProfileSubset | null | undefined): LiveMatch {
  if (!intelligence) return { ready: false, reason: "Open a job posting to see how it matches your profile." };
  if (!intelligence.sufficientForMatch) return { ready: false, reason: intelligence.insufficiencyReason ?? NOT_ENOUGH_INFO };
  if (!profileHasEvidence(profile)) return { ready: false, reason: "Sync your profile from CareerOS first. There is no approved experience or skills to compare yet." };

  const picked = scoredRequirements(intelligence);
  const requirements: Requirement[] = picked.map((item, index) => ({
    id: `live-${index}`,
    term: item.term,
    phrases: [item.term],
    snippets: [item.evidence],
    category: item.category,
    kind: item.kind === "required" ? "required" : "preferred",
    selected: true,
    possession: "unanswered",
    origin: "detected",
  }));
  const result = matchResume(resumeFromProfile(profile), requirements, defaultSettings());
  const results: LiveRequirementResult[] = result.matches.map((match, index) => ({
    term: match.requirement.term,
    kind: match.requirement.kind === "required" ? "required" : "preferred",
    status: STATUS[match.group] ?? "uncertain",
    rationale: match.explanation,
    evidence: match.evidence.map((item) => [item.label, item.text].filter(Boolean).join(": ")),
    jobEvidence: picked[index]?.evidence ?? "",
  }));
  const counts: Record<LiveStatus, number> = { matched: 0, partial: 0, missing: 0, uncertain: 0 };
  for (const item of results) counts[item.status] += 1;
  return { ready: true, percent: result.score, results, counts, note: ESTIMATE_NOTE };
}
