import { describe, expect, it } from "vitest";
import { groupRequirements } from "../../../apps/extension/src/page-intelligence/requirementGroups";
import { buildJobIntelligence } from "../../../apps/extension/src/page-intelligence/jobIntelligence";
import type { JobPageInfo } from "../../../packages/careeros-shared/types";

const job = (description: string) => ({ title: "Role", company: "Co", location: "", salary: null, description, sources: {} }) as unknown as JobPageInfo;
const groupsFor = (description: string) => groupRequirements(buildJobIntelligence(job(description), "generic", true, null).requirements);
const labels = (groups: ReturnType<typeof groupsFor>, id: string) => groups.find((g) => g.id === id)?.items.map((i) => i.label) ?? [];

const SUPPORT_JD = `About the role
Northwind Cloud Services supports small businesses moving to the cloud.
Responsibilities
• Provide Tier 1 and Tier 2 support for customers using AWS and Linux servers.
• Document fixes in our ServiceNow knowledge base.
Requirements
• 2+ years of experience in IT support or a help desk role.
• Strong knowledge of Linux, TCP/IP, DNS, and DHCP.
• Excellent communication skills.
• Bachelor's degree in Computer Science or equivalent experience.
• CompTIA Network+ or equivalent.
Preferred Qualifications
• Terraform experience is a plus.
• Familiarity with Kubernetes.
• Experience with Agile methodologies.`;

const SWE_JD = `Senior Software Engineer
What you'll do
- Design and build REST APIs that serve millions of requests.
- Mentor junior engineers and lead code reviews.
- Work with product managers to define technical roadmaps.
What you bring
- 5+ years of professional software development experience.
- Proficiency in Python or Go, and experience with PostgreSQL.
- Experience deploying services on AWS using Docker and Kubernetes.
- Strong problem-solving skills.
Nice to have
- Experience with GraphQL.
- Master's degree in a related field.`;

describe("requirement grouping", () => {
  const groups = groupsFor(SUPPORT_JD);

  it("separates qualifications, tools, education, experience and responsibilities", () => {
    expect(groups.map((g) => g.id)).toEqual(expect.arrayContaining(["required", "preferred", "tools", "experience", "education", "responsibilities"]));
    expect(labels(groups, "tools")).toEqual(expect.arrayContaining(["Linux", "Terraform", "Kubernetes", "ServiceNow"]));
    expect(labels(groups, "required")).toEqual(expect.arrayContaining(["Communication"]));
    expect(labels(groups, "preferred")).toEqual(expect.arrayContaining(["Agile"]));
    expect(labels(groups, "education").join(" ")).toMatch(/Bachelor/);
    expect(labels(groups, "experience").join(" ")).toMatch(/2\+ years/);
  });

  it("shows responsibilities in the posting's own words, without suffixes", () => {
    const resp = labels(groups, "responsibilities");
    expect(resp).toContain("Provide Tier 1 and Tier 2 support for customers using AWS and Linux servers.");
    expect(resp.some((l) => /Document fixes in our ServiceNow knowledge base/.test(l))).toBe(true);
    for (const label of groups.flatMap((g) => g.items.map((i) => i.label))) {
      expect(label).not.toMatch(/\b(responsibility|requirement)$/i);
    }
  });

  it("does not repeat a responsibility as a tool or skill", () => {
    const all = groups.flatMap((g) => g.items.map((i) => i.label.toLowerCase()));
    expect(all.filter((l) => l.startsWith("document fixes")).length).toBe(1);
  });

  it("tags importance only where a list mixes it", () => {
    const tools = groups.find((g) => g.id === "tools")!;
    expect(tools.items.find((i) => i.label === "Linux")?.importance).toBe("required");
    expect(tools.items.find((i) => i.label === "Terraform")?.importance).toBe("preferred");
    expect(groups.find((g) => g.id === "required")!.items.every((i) => i.importance === null)).toBe(true);
  });

  it("keeps the original sentence as evidence for labels", () => {
    const linux = groups.find((g) => g.id === "tools")!.items.find((i) => i.label === "Linux")!;
    expect(linux.evidence).toContain("Strong knowledge of Linux, TCP/IP, DNS, and DHCP");
  });

  it("handles a different posting style (dash bullets, 'What you bring')", () => {
    const g = groupsFor(SWE_JD);
    expect(labels(g, "tools")).toEqual(expect.arrayContaining(["Python", "Go", "PostgreSQL", "AWS", "Docker", "Kubernetes"]));
    expect(labels(g, "preferred")).toContain("GraphQL");
    expect(labels(g, "tools")).not.toContain("Mentoring");
    expect(labels(g, "experience").join(" ")).toMatch(/5\+ years/);
    expect(labels(g, "education").join(" ")).toMatch(/Master/);
    expect(labels(g, "responsibilities").join(" ")).toMatch(/Design and build REST APIs/);
    expect(g.flatMap((x) => x.items.map((i) => i.label)).join("|")).not.toMatch(/responsibility\b/i);
  });

  it("returns nothing for text without requirements", () => {
    expect(groupsFor("We are a friendly company.")).toEqual([]);
  });
});
