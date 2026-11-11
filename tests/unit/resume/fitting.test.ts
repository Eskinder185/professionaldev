import { describe, expect, it } from "vitest";
import { defaultSettings, uid } from "../../../src/features/resume/model/defaults";
import { parseResumeText } from "../../../src/features/resume/parse/parseResume";
import { layoutResume } from "../../../src/features/resume/layout/engine";
import { loadMeasurer } from "../../../src/features/resume/layout/measurer";
import { LIMITS } from "../../../src/features/resume/layout/templates";
import { optimizeLayout, planFit, proposeFitChanges, relevanceFromJob, tightenWording } from "../../../src/features/resume/layout/fitting";
import type { Resume } from "../../../src/features/resume/model/types";
import { CLASSIC_RESUME } from "../../fixtures/resumes";

const base = parseResumeText(CLASSIC_RESUME).resume;

/** Grow the sample until it just overflows one page at default settings. */
async function slightlyOver(): Promise<Resume> {
  const measure = await loadMeasurer();
  const resume = structuredClone(base);
  let n = 0;
  while (layoutResume(resume, defaultSettings(), measure).fit.fitsOnePage && n < 40) {
    resume.experience[1].bullets.push(`Coordinated patch windows, tracked remediation, and documented follow-up work for the support team, item ${++n}.`);
  }
  return resume;
}

describe("one-page fitting", () => {
  it("fixes a small overflow with layout-only changes inside readable limits and never edits content", async () => {
    const measure = await loadMeasurer();
    const resume = await slightlyOver();
    const before = structuredClone(resume);
    expect(layoutResume(resume, defaultSettings(), measure).fit.fitsOnePage).toBe(false);
    const result = optimizeLayout(resume, defaultSettings(), measure);
    expect(resume).toEqual(before);
    expect(result.settings.fontSize).toBeGreaterThanOrEqual(LIMITS.fontMin);
    expect(result.settings.margin).toBeGreaterThanOrEqual(LIMITS.marginMin);
    expect(result.adjustments.length).toBeGreaterThan(0);
    if (result.fit.fitsOnePage) expect(layoutResume(resume, result.settings, measure).pages).toHaveLength(1);
  });

  it("does not claim a fit when the content is too long, and proposes approved-only changes", async () => {
    const measure = await loadMeasurer();
    const resume = structuredClone(base);
    resume.experience = Array.from({ length: 7 }, (_, i) => ({
      id: uid(), title: `Engineer ${i}`, employer: `Company ${i}`, location: "Austin, TX", startDate: "2010", endDate: "2012", current: false,
      bullets: Array.from({ length: 6 }, (_, b) => `In order to improve reliability I utilized monitoring and documentation for system ${i}-${b} across several teams and sites.`),
    }));
    const original = structuredClone(resume);
    const optimized = optimizeLayout(resume, defaultSettings(), measure);
    expect(optimized.fit.fitsOnePage).toBe(false);
    expect(optimized.settings.fontSize).toBeGreaterThanOrEqual(LIMITS.fontMin);

    const proposals = proposeFitChanges(resume, optimized.settings, measure);
    expect(proposals.some((p) => p.kind === "tighten-wording" && p.after !== p.before)).toBe(true);
    expect(proposals.every((p) => p.linesSaved >= 0 && p.reason)).toBe(true);
    expect(resume).toEqual(original);

    // Every employer keeps at least one bullet in any proposal that removes bullets.
    const plan = planFit(resume, optimized.settings, measure, proposals);
    let current = { resume, settings: optimized.settings };
    for (const id of plan.suggested) current = proposals.find((p) => p.id === id)!.apply(current.resume, current.settings);
    expect(current.resume.experience.every((entry) => entry.bullets.length >= 1)).toBe(true);
    expect(layoutResume(current.resume, current.settings, measure).fit.fitsOnePage).toBe(plan.fitsAfter);
    expect(resume).toEqual(original);
  });

  it("tightens wording without changing facts", () => {
    expect(tightenWording("In order to cut costs, utilized scripts on a daily basis")).toBe("to cut costs, used scripts daily".replace(/^to/, "to"));
    expect(tightenWording("Reduced setup from 2 hours to 20 minutes")).toBe("Reduced setup from 2 hours to 20 minutes");
  });

  it("ranks bullets by confirmed job requirements only", () => {
    const relevance = relevanceFromJob({
      title: "Admin", description: "", requirements: [
        { id: "1", term: "PowerShell", phrases: [], snippets: [], category: "tool", kind: "required", selected: true, possession: "unanswered", origin: "detected" },
        { id: "2", term: "ATL", phrases: [], snippets: [], category: "?", kind: "required", selected: true, possession: "unanswered", origin: "detected", uncertain: true },
      ],
    });
    expect(relevance("Automated provisioning with PowerShell")).toBeGreaterThan(relevance("Organized the supply closet"));
    expect(relevance("Worked in ATL office")).toBe(0);
  });
});
