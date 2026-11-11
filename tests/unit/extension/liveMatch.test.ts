import { describe, expect, it } from "vitest";
import { computeLiveMatch, profileHasEvidence } from "../../../apps/extension/src/page-intelligence/liveMatch";
import { buildJobIntelligence } from "../../../apps/extension/src/page-intelligence/jobIntelligence";
import type { JobPageInfo, SharedProfileSubset } from "../../../packages/careeros-shared/types";

const description = `About the role
Join our infrastructure team to run production systems at scale.
Requirements
• 3+ years of experience with Linux system administration
• Experience with AWS and Terraform
• Strong knowledge of Kubernetes and Docker
• Experience with Python scripting
Nice to have
• Experience with Ansible
• Familiarity with Prometheus
Responsibilities
• Maintain reliable infrastructure and respond to incidents with the on-call rotation across the team.`;

const job = (text: string): JobPageInfo => ({ title: "Infrastructure Engineer", company: "Acme", location: "Remote", salary: "", description: text, sources: {} } as unknown as JobPageInfo);
const profile = (over: Partial<SharedProfileSubset> = {}): SharedProfileSubset => ({
  approvedAt: "2025-01-01",
  sharedFields: [],
  values: {},
  skills: ["Linux", "AWS", "Docker", "Python"],
  experience: [{ employer: "Co", title: "SysAdmin", location: "", startDate: "2020-01", endDate: "2024-01", current: false, bullets: ["Administered Linux servers and automated deploys with Python"] }],
  ...over,
});

describe("live match", () => {
  const intel = buildJobIntelligence(job(description), "generic", true, null);

  it("compares requirements with the approved profile and explains each one", () => {
    const m = computeLiveMatch(intel, profile());
    expect(m.ready).toBe(true);
    if (!m.ready) return;
    const byTerm = Object.fromEntries(m.results.map((r) => [r.term.toLowerCase(), r]));
    expect(byTerm["linux"]?.status).toBe("matched");
    expect(byTerm["terraform"]?.status).toBe("missing");
    expect(m.results.every((r) => r.rationale.length > 0)).toBe(true);
    expect(m.percent).toBeGreaterThan(0);
    expect(m.percent).toBeLessThan(100);
    expect(m.note).toMatch(/not an ATS score/i);
  });

  it("refuses to estimate from thin job information", () => {
    const thin = buildJobIntelligence(job("Great team. Apply now!"), "generic", true, null);
    const m = computeLiveMatch(thin, profile());
    expect(m).toEqual({ ready: false, reason: expect.stringContaining("Not enough job information to calculate a reliable match.") });
  });

  it("does not invent a score when no profile is synced", () => {
    expect(profileHasEvidence(null)).toBe(false);
    const m = computeLiveMatch(intel, null);
    expect(m.ready).toBe(false);
  });

  it("has nothing to say without a page", () => {
    expect(computeLiveMatch(null, profile()).ready).toBe(false);
  });
});
