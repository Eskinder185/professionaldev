import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../../src/features/resume/model/defaults";
import { parseResumeText } from "../../../src/features/resume/parse/parseResume";
import { analyzeJob, emptyJob, updateRequirement } from "../../../src/features/resume/job/requirements";
import { diffMatches, matchResume, parseDate } from "../../../src/features/resume/job/match";
import { buildSuggestions, hasPlaceholder, toActionVerb } from "../../../src/features/resume/job/suggestions";
import { CLASSIC_RESUME } from "../../fixtures/resumes";
import { IT_SUPPORT_JD } from "../../fixtures/jobs";

const settings = defaultSettings();
const resume = parseResumeText(CLASSIC_RESUME).resume;
const job = () => analyzeJob({ ...emptyJob(), description: IT_SUPPORT_JD });
const answer = (current: ReturnType<typeof job>, term: string, possession: "has" | "not" | "uncertain" | "unanswered") =>
  updateRequirement(current, current.requirements.find((item) => item.term === term)!.id, { possession });
const statusOf = (result: ReturnType<typeof matchResume>, term: string) => result.matches.find((match) => match.requirement.term === term);

describe("matchResume", () => {
  const result = matchResume(resume, job().requirements, settings);

  it("separates demonstrated evidence from skills-list mentions", () => {
    expect(statusOf(result, "PowerShell")).toMatchObject({ status: "demonstrated", group: "matched" });
    expect(statusOf(result, "PowerShell")?.evidence[0]).toMatchObject({ section: "Experience" });
    expect(statusOf(result, "PowerShell")?.evidence[0].text).toMatch(/Automated new-hire account provisioning/);
    expect(statusOf(result, "CompTIA A+")).toMatchObject({ status: "demonstrated" });
    expect(statusOf(result, "TCP/IP")).toMatchObject({ status: "mentioned", group: "strengthen" });
    expect(statusOf(result, "TCP/IP")?.evidence[0].section).toBe("Skills");
    expect(statusOf(result, "HIPAA")).toMatchObject({ status: "missing", group: "missing", evidence: [] });
  });

  it("evaluates years of experience from dated roles and degree level from education", () => {
    const years = result.matches.find((match) => match.requirement.category === "Experience");
    expect(years).toMatchObject({ status: "demonstrated" });
    expect(years?.explanation).toMatch(/about \d+(\.\d)? years \(needs 2\)/);
    const degree = result.matches.find((match) => match.requirement.category === "Education");
    expect(degree?.status).toBe("equivalent");
    expect(degree?.explanation).toMatch(/different field/);
  });

  it("does not credit expertise from an unrelated keyword", () => {
    const unrelated = { ...resume, summary: "I enjoy reading about sql injection in the news." };
    const sql = matchResume(unrelated, [{ id: "r", term: "SQL", phrases: ["SQL"], snippets: [], category: "Programming Languages", kind: "required", selected: true, possession: "unanswered", origin: "user" }], settings);
    expect(sql.matches[0].status).toBe("mentioned");
    expect(sql.matches[0].group).toBe("strengthen");
  });

  it("uses credible equivalents and labels them", () => {
    const siem = matchResume({ ...resume, experience: [{ ...resume.experience[0], bullets: ["Investigated alerts in Splunk dashboards."] }] }, [{ id: "s", term: "SIEM", phrases: ["SIEM"], snippets: [], category: "Security", kind: "required", selected: true, possession: "unanswered", origin: "detected" }], settings);
    expect(siem.matches[0]).toMatchObject({ status: "equivalent", group: "matched" });
  });

  it("produces a documented score with separate document quality", () => {
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBe(Math.round(result.coverage * 0.8 + result.evidenceQuality * 0.2));
    expect(result.documentQuality.total).toBeGreaterThan(0);
    expect(result.requiredCoverage.total).toBeGreaterThan(0);
  });

  it("ignores unselected requirements and explains score changes", () => {
    let current = job();
    const before = matchResume(resume, current.requirements, settings);
    const hipaa = current.requirements.find((item) => item.term === "HIPAA")!;
    current = updateRequirement(current, hipaa.id, { selected: false });
    const after = matchResume(resume, current.requirements, settings);
    expect(after.matches.some((match) => match.requirement.term === "HIPAA")).toBe(false);
    expect(after.score).toBeGreaterThan(before.score);
    expect(diffMatches(before, after)).toContain("“HIPAA” is no longer included.");
  });

  it("parses common résumé date formats", () => {
    expect(parseDate("Jan 2022")).toBeCloseTo(2022, 1);
    expect(parseDate("03/2019")).toBeCloseTo(2019 + 2 / 12, 2);
    expect(parseDate("Summer 2021")).toBeCloseTo(2021.4167, 2);
    expect(parseDate("Present", new Date(2026, 0, 1))).toBe(2026);
    expect(parseDate("someday")).toBeNull();
  });
});

describe("buildSuggestions", () => {
  it("never proposes skills the user has not confirmed", () => {
    for (const possession of ["unanswered", "not", "uncertain"] as const) {
      const current = answer(job(), "HIPAA", possession);
      const suggestions = buildSuggestions(resume, settings, matchResume(resume, current.requirements, settings));
      expect(suggestions.some((suggestion) => suggestion.kind === "add-skill" && suggestion.title === "HIPAA")).toBe(false);
    }
  });

  it("proposes a confirmed skill and recalculates the match after acceptance", () => {
    const current = answer(job(), "HIPAA", "has");
    const before = matchResume(resume, current.requirements, settings);
    const suggestion = buildSuggestions(resume, settings, before).find((item) => item.key === "skill:HIPAA")!;
    expect(suggestion.evidence).toBe("Your answer: I have this");
    const updated = suggestion.apply!(suggestion.proposed, resume, settings).resume!;
    expect(updated.skills.find((category) => category.name === "Compliance & Domain")?.skills).toEqual(["HIPAA"]);
    const after = matchResume(updated, current.requirements, settings);
    expect(after.matches.find((match) => match.requirement.term === "HIPAA")?.status).toBe("mentioned");
    // Coverage rises; evidence quality may fall because a skills entry is weaker than an example.
    expect(after.coverage).toBeGreaterThan(before.coverage);
    // The original résumé object is untouched until the user accepts.
    expect(resume.skills.some((category) => category.name === "Compliance & Domain")).toBe(false);
  });

  it("requires the user to replace placeholders before an example bullet can be applied", () => {
    const current = answer(job(), "TCP/IP", "has");
    const suggestion = buildSuggestions(resume, settings, matchResume(resume, current.requirements, settings)).find((item) => item.key === "strengthen:TCP/IP")!;
    expect(hasPlaceholder(suggestion.proposed)).toBe(true);
    expect(suggestion.explanation).toMatch(/cannot be applied while placeholders remain/);
  });

  it("gives advice, not résumé text, for qualifications the user lacks", () => {
    const current = answer(job(), "HIPAA", "not");
    const advice = buildSuggestions(resume, settings, matchResume(resume, current.requirements, settings)).find((item) => item.key === "missing:HIPAA")!;
    expect(advice.kind).toBe("explain-missing");
    expect(advice.apply).toBeUndefined();
    expect(advice.explanation).toMatch(/Don't add it/);
  });

  it("tailors the summary only with requirements already demonstrated", () => {
    const suggestions = buildSuggestions(resume, settings, matchResume(resume, job().requirements, settings));
    const summary = suggestions.find((item) => item.kind === "tailor-summary");
    expect(summary?.proposed).toMatch(/Hands-on experience with/);
    expect(summary?.proposed).not.toMatch(/HIPAA/);
  });

  it("rewrites weak openers without changing meaning, and skips unclear cases", () => {
    expect(toActionVerb("Responsible for managing the service desk queue.")).toBe("Managed the service desk queue.");
    expect(toActionVerb("Helped with building onboarding guides.")).toBe("Built onboarding guides.");
    expect(toActionVerb("Tasked with supporting 200 users.")).toBe("Supported 200 users.");
    expect(toActionVerb("Responsible for the network.")).toBeNull();
    expect(toActionVerb("Resolved tickets.")).toBeNull();
  });
});
