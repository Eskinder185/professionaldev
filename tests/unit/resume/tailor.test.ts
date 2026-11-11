import { describe, expect, it } from "vitest";
import { defaultSettings, formatVersionName } from "../../../src/features/resume/model/defaults";
import { parseResumeText } from "../../../src/features/resume/parse/parseResume";
import { analyzeJob, emptyJob } from "../../../src/features/resume/job/requirements";
import { buildTailoredProposal, rankTextRelevance } from "../../../src/features/resume/tailor/tailorEngine";
import { CLASSIC_RESUME } from "../../fixtures/resumes";
import { IT_SUPPORT_JD } from "../../fixtures/jobs";

describe("Master Profile & Smart One-Page Tailoring", () => {
  it("formats descriptive version names by company and role", () => {
    expect(formatVersionName("Amazon", "Data Center Technician")).toBe("Amazon — Data Center Technician");
    expect(formatVersionName("Google", "IT Support Engineer")).toBe("Google — IT Support Engineer");
    expect(formatVersionName("", "Cloud Operations")).toBe("Cloud Operations — Tailored One-Page");
  });

  it("ranks bullets by confirmed job requirements and builds a one-page tailored proposal without mutating the Master Profile", () => {
    const master = parseResumeText(CLASSIC_RESUME).resume;
    const masterSnapshot = JSON.stringify(master);
    const job = analyzeJob({ ...emptyJob(), company: "Amazon", title: "IT Support Engineer", description: IT_SUPPORT_JD });

    const rel = rankTextRelevance("Automated new-hire account provisioning with PowerShell and Active Directory.", job);
    expect(rel.score).toBeGreaterThan(0);
    expect(rel.matchedTerms).toEqual(expect.arrayContaining(["PowerShell", "Active Directory"]));

    const proposal = buildTailoredProposal(master, defaultSettings(), job);
    expect(proposal.versionName).toBe("Amazon — IT Support Engineer");
    expect(proposal.fitAfter.fitsOnePage).toBe(true);
    expect(proposal.fitAfter.label).toBe("Page Fit: 1 of 1");
    // Master profile is completely untouched
    expect(JSON.stringify(master)).toBe(masterSnapshot);
  });
});
