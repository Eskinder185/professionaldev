import { formatVersionName } from "../model/defaults";
import type { DocumentSettings, JobTarget, Resume } from "../model/types";
import { layoutResume } from "../layout/engine";
import { optimizeLayout, tightenWording } from "../layout/fitting";
import type { FitReport } from "../layout/types";
import { aliasesFor, termRegex } from "../job/taxonomy";

export type RankedBullet = {
  section: "experience" | "projects";
  entryId: string;
  entryLabel: string;
  bulletIndex: number;
  text: string;
  score: number;
  matchedTerms: string[];
  included: boolean;
};

export type TailoredProposal = {
  versionName: string;
  company: string;
  role: string;
  tailoredResume: Resume;
  tailoredSettings: DocumentSettings;
  fitBefore: FitReport;
  fitAfter: FitReport;
  rankedBullets: RankedBullet[];
  omittedCount: number;
};

/** Score a text span against confirmed job requirements and return the matched requirement terms. */
export function rankTextRelevance(text: string, job?: JobTarget): { score: number; matchedTerms: string[] } {
  if (!job || !text.trim()) return { score: 0, matchedTerms: [] };
  let score = 0;
  const matchedTerms: string[] = [];
  for (const req of job.requirements) {
    if (!req.selected || req.kind === "context") continue;
    if (req.uncertain && req.possession !== "has") continue;
    const weight = req.kind === "required" ? 3 : req.kind === "preferred" ? 1.5 : 1;
    const spellings = [req.term, ...aliasesFor(req.term), ...req.phrases];
    if (spellings.some((s) => s.trim().length >= 2 && termRegex(s, "").test(text))) {
      score += weight;
      if (!matchedTerms.includes(req.term)) matchedTerms.push(req.term);
    }
  }
  return { score, matchedTerms };
}

/**
 * Build a tailored one-page résumé proposal from the Master Profile for a target job.
 * Never mutates the Master Profile.
 */
export function buildTailoredProposal(
  master: Resume,
  settings: DocumentSettings,
  job?: JobTarget,
): TailoredProposal {
  const company = job?.company?.trim() || job?.metadata?.company?.trim() || "";
  const role = job?.title?.trim() || master.targetRole?.trim() || "";
  const versionName = formatVersionName(company, role, "Tailored One-Page");

  const fitBefore = layoutResume(master, settings).fit;

  // Prioritize matched skills at the front of each skill category without dropping any skill.
  const tailoredSkills = master.skills.map((cat) => {
    const scored = cat.skills.map((skill, idx) => ({
      skill,
      idx,
      score: rankTextRelevance(skill, job).score,
    }));
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
    return { ...cat, skills: scored.map((s) => s.skill) };
  });

  // Collect all bullets from master experience and projects with their relevance scores.
  const rankedBullets: RankedBullet[] = [];
  for (const exp of master.experience) {
    const label = [exp.title, exp.employer].filter(Boolean).join(" — ") || "Experience";
    exp.bullets.forEach((b, idx) => {
      const { score, matchedTerms } = rankTextRelevance(b, job);
      rankedBullets.push({
        section: "experience",
        entryId: exp.id,
        entryLabel: label,
        bulletIndex: idx,
        text: tightenWording(b),
        score,
        matchedTerms,
        included: true,
      });
    });
  }
  for (const proj of master.projects) {
    const label = proj.name || "Project";
    proj.bullets.forEach((b, idx) => {
      const { score, matchedTerms } = rankTextRelevance(b, job);
      rankedBullets.push({
        section: "projects",
        entryId: proj.id,
        entryLabel: label,
        bulletIndex: idx,
        text: tightenWording(b),
        score,
        matchedTerms,
        included: true,
      });
    });
  }

  const assemble = (bullets: RankedBullet[]): Resume => ({
    ...master,
    targetRole: role || master.targetRole,
    skills: tailoredSkills,
    experience: master.experience.map((exp) => ({
      ...exp,
      bullets: bullets
        .filter((b) => b.section === "experience" && b.entryId === exp.id && b.included)
        .map((b) => b.text),
    })),
    projects: master.projects.map((proj) => ({
      ...proj,
      bullets: bullets
        .filter((b) => b.section === "projects" && b.entryId === proj.id && b.included)
        .map((b) => b.text),
    })),
  });

  let workingResume = assemble(rankedBullets);
  const layoutOpt = optimizeLayout(workingResume, { ...settings, pagePreference: "one" });
  const tailoredSettings = layoutOpt.settings;

  // If still over one page after readable layout optimization, deselect lowest-relevance optional bullets
  // (always keeping at least 1 bullet per experience/project entry).
  let currentLayout = layoutResume(workingResume, tailoredSettings);
  if (!currentLayout.fit.fitsOnePage) {
    // Candidate bullets to omit: lowest score first, later bullets within an entry first.
    const candidates = [...rankedBullets].sort(
      (a, b) => a.score - b.score || b.bulletIndex - a.bulletIndex,
    );
    for (const candidate of candidates) {
      if (currentLayout.fit.fitsOnePage) break;
      const siblingsIncluded = rankedBullets.filter(
        (b) => b.section === candidate.section && b.entryId === candidate.entryId && b.included,
      );
      if (siblingsIncluded.length <= 1) continue;
      candidate.included = false;
      workingResume = assemble(rankedBullets);
      currentLayout = layoutResume(workingResume, tailoredSettings);
    }
  }

  const omittedCount = rankedBullets.filter((b) => !b.included).length;

  return {
    versionName,
    company,
    role,
    tailoredResume: workingResume,
    tailoredSettings,
    fitBefore,
    fitAfter: currentLayout.fit,
    rankedBullets,
    omittedCount,
  };
}
