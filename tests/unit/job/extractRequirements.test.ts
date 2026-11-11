import { describe, expect, it } from "vitest";
import { extractRequirements, groupByCategory } from "../../../src/features/resume/job/extractRequirements";
import { addRequirement, analyzeJob, emptyJob, normalizeJob, removeRequirement, renameCategory, requirementSummary, updateRequirement } from "../../../src/features/resume/job/requirements";
import { IT_SUPPORT_JD, NO_TECH_JD, SECURITY_JD, SOFTWARE_JD } from "../../fixtures/jobs";

const find = (description: string, term: string) => extractRequirements(description).requirements.find((item) => item.term === term);

describe("extractRequirements", () => {
  it("classifies required, preferred, responsibility, and context terms from headings", () => {
    expect(find(IT_SUPPORT_JD, "TCP/IP")).toMatchObject({ kind: "required", category: "Networking", selected: true });
    expect(find(IT_SUPPORT_JD, "CompTIA A+")).toMatchObject({ kind: "required", category: "Certifications" });
    expect(find(IT_SUPPORT_JD, "CompTIA Network+")).toMatchObject({ kind: "preferred" });
    expect(find(IT_SUPPORT_JD, "PowerShell")).toMatchObject({ kind: "preferred", phrases: ["PowerShell scripting"] });
    expect(find(IT_SUPPORT_JD, "ServiceNow")).toMatchObject({ kind: "responsibility" });
    // Mentioned only in "About us": kept as context and not preselected.
    expect(find(IT_SUPPORT_JD, "Teamwork")).toMatchObject({ kind: "context", selected: false });
  });

  it("extracts education and years of experience with their original wording", () => {
    expect(find(IT_SUPPORT_JD, "Associate degree in Information Technology")).toMatchObject({ category: "Education", kind: "required" });
    expect(find(IT_SUPPORT_JD, "2+ years: IT support or a help desk role")).toMatchObject({ category: "Experience" });
    const security = extractRequirements(SECURITY_JD).requirements;
    expect(security.find((item) => item.category === "Experience")?.term).toBe("3–5 years: security operations");
    expect(security.find((item) => item.category === "Education")?.term).toBe("Bachelor's degree in Computer Science");
  });

  it("maps aliases to normalized terms and keeps the original phrase", () => {
    const iam = find(SECURITY_JD, "AWS IAM");
    expect(iam).toMatchObject({ category: "Cloud Platforms", phrases: ["AWS Identity and Access Management"] });
    expect(iam?.snippets[0]).toMatch(/Review AWS Identity and Access Management policies/);
    // The specific match consumes the text, so generic IAM is not also reported.
    expect(find(SECURITY_JD, "Identity & Access Management")).toBeUndefined();
    expect(find(SECURITY_JD, "Vulnerability management")?.phrases).toEqual(["vulnerability scanning"]);
    expect(find(SECURITY_JD, "Amazon EC2")).toBeDefined();
  });

  it("flags unknown acronyms instead of silently dropping or trusting them", () => {
    expect(find(SECURITY_JD, "XSOAR")).toMatchObject({ category: "Other technical terms", uncertain: true });
    expect(find(IT_SUPPORT_JD, "PTO")).toBeUndefined();
  });

  it("classifies sentence by sentence when a description has no headings", () => {
    expect(find(SOFTWARE_JD, "PostgreSQL")).toMatchObject({ kind: "required" });
    expect(find(SOFTWARE_JD, "Docker")).toMatchObject({ kind: "preferred" });
    expect(find(SOFTWARE_JD, "Unit testing")).toMatchObject({ kind: "responsibility" });
    expect(find(SOFTWARE_JD, "C#")).toMatchObject({ kind: "preferred" });
    expect(find(SOFTWARE_JD, "Go")).toMatchObject({ kind: "preferred" });
  });

  it("does not match short terms inside ordinary words", () => {
    const result = extractRequirements("We go above and beyond. Our C-level team uses spreadsheets. Visit our R&D page.");
    expect(result.requirements.map((item) => item.term)).not.toEqual(expect.arrayContaining(["Go", "C", "R"]));
  });

  it("merges duplicates and keeps the strongest classification", () => {
    const description = "About us\nWe use Python daily.\nRequirements\n- Python\n- python scripting experience\nPreferred\n- Python 3";
    const matches = extractRequirements(description).requirements.filter((item) => item.term === "Python");
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe("required");
  });

  it("returns nothing for descriptions without recognizable requirements", () => {
    expect(extractRequirements(NO_TECH_JD).requirements).toEqual([]);
  });

  it("handles very long descriptions quickly", () => {
    const long = Array.from({ length: 60 }, () => SECURITY_JD).join("\n\n");
    const started = performance.now();
    const result = extractRequirements(long);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(result.requirements.filter((item) => item.term === "AWS IAM")).toHaveLength(1);
  });

  it("generates categories from the description, with responsibilities last", () => {
    const groups = groupByCategory(extractRequirements(SECURITY_JD).requirements).map((group) => group.category);
    expect(groups).toContain("Security");
    expect(groups).not.toContain("Databases");
    expect(groups.slice(-2)).toEqual(["Responsibilities", "Other technical terms"]);
  });

  it("never classifies city names, US state abbreviations, salary units, company names, or generic uppercase words as job qualifications", () => {
    const jd = `
      Company: Amazon Data Services Inc.
      Location: Stone Mountain, GA 30083 (On-site near Atlanta, GA and Ashburn, VA)
      Compensation: $85,000 - $110,000/yr USD ($42/hr base + RSU)
      Full-Time Shift Role

      Requirements
      - MUST HAVE 2+ years of experience with Linux, TCP/IP, and structured cabling in Atlanta, GA or Austin, TX.
      - REQUIRED: Able to lift 50 LBS, work FULL TIME DAY or NIGHT SHIFT, and wear PPE in Stone Mountain, GA.
      - Experience at Amazon Data Services Inc. or Lone Star Health Services LLC is a PLUS.
      - Familiarity with Proxmox VE, Debian, SSH, and CompTIA Server+ preferred.
    `;
    const result = extractRequirements(jd);
    const terms = result.requirements.map((r) => r.term.toUpperCase());

    // Real requirements ARE extracted:
    expect(result.requirements.some((r) => r.term === "Linux")).toBe(true);
    expect(result.requirements.some((r) => r.term === "TCP/IP")).toBe(true);
    expect(result.requirements.some((r) => r.term === "Structured cabling")).toBe(true);
    expect(result.requirements.some((r) => r.term === "Proxmox VE")).toBe(true);
    expect(result.requirements.some((r) => r.term === "Debian")).toBe(true);
    expect(result.requirements.some((r) => r.term === "SSH")).toBe(true);
    expect(result.requirements.some((r) => r.term === "CompTIA Server+")).toBe(true);

    // Non-requirements are NEVER extracted as skills or uncertain terms:
    for (const forbidden of [
      "GA", "VA", "TX", "ATL", "ATLANTA", "STONE", "MOUNTAIN", "AUSTIN", "ASHBURN",
      "USD", "YR", "HR", "RSU", "LBS", "PPE",
      "LLC", "INC", "AMAZON",
      "MUST", "HAVE", "REQUIRED", "FULL", "TIME", "DAY", "NIGHT", "SHIFT", "PLUS",
    ]) {
      expect(terms).not.toContain(forbidden);
    }

    // Metadata is extracted separately into result.metadata:
    expect(result.metadata).toMatchObject({
      company: "Amazon Data Services Inc",
      location: "Stone Mountain, GA 30083 (On-site near Atlanta, GA and Ashburn, VA)",
      workMode: "On-site",
      employmentType: "Full-time",
    });
    expect(result.metadata.compensation).toMatch(/\$85,000/);
  });
});

describe("requirement editing", () => {
  const analyzed = () => analyzeJob({ ...emptyJob(), description: IT_SUPPORT_JD });

  it("preselects detected requirements without recording any answer", () => {
    const job = analyzed();
    const summary = requirementSummary(job.requirements);
    expect(summary.selected).toBe(job.requirements.filter((item) => item.kind !== "context").length);
    expect(summary.unanswered).toBe(summary.selected);
    expect(job.requirements.every((item) => item.possession === "unanswered")).toBe(true);
  });

  it("supports adding, re-categorizing, reclassifying, answering, and removing", () => {
    let job = analyzed();
    job = addRequirement(job, "Jamf", "Device management", "preferred");
    const jamf = job.requirements.find((item) => item.term === "Jamf")!;
    expect(jamf).toMatchObject({ origin: "user", selected: true, kind: "preferred", category: "Device management" });
    const dns = job.requirements.find((item) => item.term === "DNS")!;
    job = updateRequirement(job, dns.id, { category: "Core networking", kind: "preferred", possession: "has" });
    expect(job.requirements.find((item) => item.id === dns.id)).toMatchObject({ category: "Core networking", kind: "preferred", possession: "has" });
    job = renameCategory(job, "Core networking", "Networking basics");
    expect(job.requirements.find((item) => item.id === dns.id)?.category).toBe("Networking basics");
    job = removeRequirement(job, dns.id);
    expect(job.requirements.some((item) => item.term === "DNS")).toBe(false);
    expect(job.removedTerms).toContain("DNS");
  });

  it("keeps user decisions and removals when re-analyzing", () => {
    let job = analyzed();
    const tcp = job.requirements.find((item) => item.term === "TCP/IP")!;
    job = updateRequirement(job, tcp.id, { possession: "has", selected: false });
    job = removeRequirement(job, job.requirements.find((item) => item.term === "DHCP")!.id);
    job = addRequirement(job, "Jamf", "", "required");
    job = analyzeJob({ ...job, description: `${job.description}\n- Experience with Jira.` });
    expect(job.requirements.find((item) => item.term === "TCP/IP")).toMatchObject({ possession: "has", selected: false, id: tcp.id });
    expect(job.requirements.some((item) => item.term === "DHCP")).toBe(false);
    expect(job.requirements.some((item) => item.term === "Jamf")).toBe(true);
    expect(job.requirements.some((item) => item.term === "Jira")).toBe(true);
  });

  it("de-duplicates user additions against existing requirements", () => {
    const job = analyzed();
    const again = addRequirement(job, "dns", "Mine", "required");
    expect(again.requirements.filter((item) => item.term.toLowerCase() === "dns")).toHaveLength(1);
  });

  it("repairs malformed stored data", () => {
    const job = normalizeJob({ description: 5, requirements: [{ term: "SQL", kind: "bogus", possession: "maybe" }, { nope: true }, null] });
    expect(job?.description).toBe("5");
    expect(job?.requirements).toHaveLength(1);
    expect(job?.requirements[0]).toMatchObject({ term: "SQL", kind: "required", possession: "unanswered", selected: true, category: "Other" });
  });
});
