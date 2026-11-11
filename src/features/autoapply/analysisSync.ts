import { layoutResume } from "../resume/layout/engine";
import { defaultMeasurer } from "../resume/layout/measurer";
import { analyzeJob } from "../resume/job/requirements";
import { matchResume } from "../resume/job/match";
import { documentChecks } from "../resume/review/checks";
import type { ResumeVersion } from "../resume/model/types";
import { isLoopbackHost, validateEndpoint } from "../ai/endpoint";
import { PROVIDERS } from "../ai/providers";
import type { ConnectionState } from "../ai/connectionState";
import type {
  AIConnectionSnapshot,
  AutoApplyQueueItem,
  RequirementAnalysis,
  ResumeAnalysisSnapshot,
  ResumeVersionSummary,
} from "../../../packages/careeros-shared/types";

const MIN_DESCRIPTION_CHARS = 15;

function fitsOnePage(version: ResumeVersion): { pageCount: number; fits: boolean } {
  try {
    const layout = layoutResume(version.resume, version.settings, defaultMeasurer);
    return { pageCount: layout.fit.pageCount, fits: layout.fit.fitsOnePage };
  } catch {
    return { pageCount: 1, fits: true };
  }
}

export function summarizeVersions(versions: ResumeVersion[]): ResumeVersionSummary[] {
  return versions.map((v) => ({
    id: v.id,
    name: v.name,
    kind: v.kind === "tailored" ? "tailored" : "master",
    fitsOnePage: fitsOnePage(v).fits,
    updatedAt: v.updatedAt,
  }));
}

/**
 * Runs the real CareerOS job-matching engine for one queue item against one résumé version.
 * Returns null when the job has no description to analyze: the extension then shows
 * "no analysis" rather than an invented score.
 */
export function buildAnalysisSnapshot(
  item: AutoApplyQueueItem,
  version: ResumeVersion,
): ResumeAnalysisSnapshot | null {
  if (item.jobDescription.trim().length <= MIN_DESCRIPTION_CHARS) return null;
  const job = analyzeJob({
    title: item.title,
    company: item.company,
    description: item.jobDescription,
    requirements: [],
  });
  const selected = job.requirements.filter((r) => r.selected);
  if (selected.length === 0) return null;

  const { pageCount, fits } = fitsOnePage(version);
  const match = matchResume(version.resume, job.requirements, version.settings, pageCount);
  const checks = documentChecks(version.resume, version.settings, pageCount);

  const requirements: RequirementAnalysis[] = match.matches.map((m) => ({
    id: m.requirement.id,
    name: m.requirement.term,
    kind: m.requirement.kind,
    category: m.requirement.category,
    excerpt: m.requirement.snippets.join(" ").slice(0, 400),
    status: m.status,
    group: m.group,
    evidence: m.evidence.slice(0, 4),
    explanation: m.explanation,
    scored: !m.requirement.uncertain || m.requirement.possession === "has",
  }));

  return {
    applicationId: item.id,
    resumeVersionId: version.id,
    resumeVersionName: version.name,
    analyzedAt: new Date().toISOString(),
    score: match.score,
    requiredCoverage: match.requiredCoverage,
    preferredCoverage: match.preferredCoverage,
    counts: match.counts,
    requirements,
    quality: {
      pageCount,
      fitsOnePage: fits,
      passed: match.documentQuality.passed,
      total: match.documentQuality.total,
      percent: match.documentQuality.percent,
      checks: checks.map((c) => ({ id: c.id, label: c.label, passed: c.ok, detail: c.detail })),
    },
  };
}

export function buildAnalysisSnapshots(
  items: AutoApplyQueueItem[],
  versions: ResumeVersion[],
): ResumeAnalysisSnapshot[] {
  const out: ResumeAnalysisSnapshot[] = [];
  for (const item of items) {
    for (const version of versions) {
      const snap = buildAnalysisSnapshot(item, version);
      if (snap) out.push(snap);
    }
  }
  return out;
}

/** Describes the AI connection without ever including the API key. */
export function buildAIConnectionSnapshot(state: ConnectionState, connected: boolean): AIConnectionSnapshot | null {
  const preset = PROVIDERS[state.provider];
  const endpoint = validateEndpoint(state.baseUrl);
  if (!endpoint.ok) return null;
  let host: string;
  try {
    host = new URL(endpoint.baseUrl).hostname;
  } catch {
    return null;
  }
  return {
    provider: state.provider,
    providerLabel: preset.label,
    baseUrl: endpoint.baseUrl,
    model: state.model,
    connected,
    // "Local" means the destination host is loopback, regardless of provider label.
    isLocal: isLoopbackHost(host),
    keyless: !preset.keyRequired && state.apiKey.length === 0,
    updatedAt: new Date().toISOString(),
  };
}
