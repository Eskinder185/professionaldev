import { describe, expect, it } from "vitest";
import { parseResumeText, resumeToPlainText } from "../../../src/features/resume/parse/parseResume";
import { findDates } from "../../../src/features/resume/parse/patterns";
import { CLASSIC_RESUME, COLLAPSED_RESUME, COMPACT_RESUME, UNSTRUCTURED_RESUME } from "../../fixtures/resumes";

describe("parseResumeText — classic layout", () => {
  const { resume, issues } = parseResumeText(CLASSIC_RESUME);

  it("extracts contact fields from a pipe-separated header", () => {
    expect(resume.contact).toMatchObject({
      name: "Jordan Rivera",
      headline: "IT Support Specialist",
      email: "jordan.rivera@example.com",
      phone: "(512) 555-0142",
      location: "Austin, TX",
      linkedin: "linkedin.com/in/jordanrivera",
      github: "github.com/jrivera",
    });
  });

  it("keeps the summary as its own section", () => {
    expect(resume.summary).toMatch(/^IT support specialist with three years/);
    expect(resume.summary).not.toMatch(/TECHNICAL SKILLS/);
  });

  it("parses categorized skills, keeps parenthesized lists intact, and removes duplicates", () => {
    expect(resume.skills.map((category) => category.name)).toEqual(["Operating Systems", "Networking", "Tools", "Cloud"]);
    expect(resume.skills[2].skills).toContain("Python (pandas, requests)");
    expect(resume.skills[3].skills).toContain("AWS (EC2, S3, IAM)");
    const all = resume.skills.flatMap((category) => category.skills.map((skill) => skill.toLowerCase()));
    expect(all.filter((skill) => skill === "powershell")).toHaveLength(1);
    expect(issues.some((issue) => /duplicate skill/.test(issue.message))).toBe(true);
  });

  it("splits experience into entries with titles, employers, locations, dates, and bullets", () => {
    expect(resume.experience).toHaveLength(2);
    expect(resume.experience[0]).toMatchObject({ title: "IT Support Specialist", employer: "Lone Star Health Services", location: "Austin, TX", startDate: "Jan 2022", endDate: "Present", current: true });
    expect(resume.experience[0].bullets).toHaveLength(3);
    // A wrapped bullet line is joined, not turned into a new bullet or entry.
    expect(resume.experience[0].bullets[1]).toBe("Automated new-hire account provisioning with PowerShell, reducing setup time from two hours to twenty minutes.");
    expect(resume.experience[1]).toMatchObject({ title: "Help Desk Technician", employer: "Capital Tech Solutions", location: "Round Rock, TX", startDate: "Jun 2020", endDate: "Dec 2021", current: false });
  });

  it("parses projects with technologies and repository links", () => {
    expect(resume.projects[0]).toMatchObject({ name: "Home Lab Network", technologies: ["pfSense", "VLANs", "Raspberry Pi"], githubUrl: "github.com/jrivera/homelab" });
    expect(resume.projects[0].bullets).toHaveLength(2);
  });

  it("parses education, certifications, and awards", () => {
    expect(resume.education[0]).toMatchObject({ institution: "Austin Community College", degree: "Associate of Applied Science", field: "Network Administration", endDate: "May 2020" });
    expect(resume.certifications.map((cert) => [cert.name, cert.issuer, cert.date])).toEqual([
      ["CompTIA A+", "CompTIA", "2020"],
      ["CompTIA Network+", "CompTIA", "Mar 2021"],
    ]);
    expect(resume.awards[0].text).toMatch(/Employee of the Quarter/);
  });

  it("does not silently discard content", () => {
    const output = resumeToPlainText(resume).toLowerCase();
    for (const phrase of ["35 tickets", "120 laptops", "grafana", "knowledge base", "employee of the quarter", "network administration"]) expect(output).toContain(phrase);
  });
});

describe("parseResumeText — other layouts", () => {
  it("handles dates on their own line, 'at' separators, hyphen bullets, and wrapped lines", () => {
    const { resume, issues } = parseResumeText(COMPACT_RESUME);
    expect(resume.experience).toHaveLength(2);
    expect(resume.experience[0]).toMatchObject({ title: "Software Developer", employer: "Northwind Labs", startDate: "Mar 2021", current: true });
    expect(resume.experience[0].bullets[1]).toMatch(/cutting update latency by half\.$/);
    // A second role with no employer line is linked to the previous employer, and flagged.
    expect(resume.experience[1]).toMatchObject({ title: "Junior Developer", employer: "Northwind Labs", startDate: "Jan 2020", endDate: "Feb 2021" });
    expect(issues.some((issue) => /linked to Northwind Labs/.test(issue.message))).toBe(true);
    expect(resume.education[0]).toMatchObject({ institution: "University of Washington", degree: "B.S.", field: "Computer Science", gpa: "3.6/4.0", endDate: "2019" });
    expect(resume.custom[0]).toMatchObject({ title: "Volunteer Experience" });
    expect(resume.skills[0].skills.filter((skill) => skill.toLowerCase() === "javascript")).toHaveLength(1);
  });

  it("reconstructs collapsed text and warns the user to review it", () => {
    const { resume, issues } = parseResumeText(COLLAPSED_RESUME);
    expect(issues[0]).toMatchObject({ section: "extraction", severity: "warning" });
    expect(resume.summary).toMatch(/Data analyst/);
    expect(resume.skills[0].skills).toEqual(["SQL", "Python", "Tableau", "Excel"]);
    expect(resume.experience[0]).toMatchObject({ title: "Data Analyst", employer: "Contoso Retail Group" });
    expect(resume.experience[0].bullets).toHaveLength(2);
    expect(resume.education[0].institution).toBe("Ohio State University");
  });

  it("keeps unstructured text visible instead of guessing sections", () => {
    const { resume, issues } = parseResumeText(UNSTRUCTURED_RESUME);
    expect(resume.contact.name).toBe("Riley Morgan");
    expect(resume.experience).toHaveLength(0);
    expect(resume.custom[0].title).toBe("Imported content");
    expect(resume.custom[0].items.map((item) => item.text).join(" ")).toMatch(/point of sale network/);
    expect(issues.some((issue) => /No standard section headings/.test(issue.message))).toBe(true);
  });

  it("flags roles without dates rather than inventing them", () => {
    const { resume, issues } = parseResumeText("Pat Lee\npat@example.com\nExperience\nWarehouse Associate, Example Logistics Inc\n• Packed orders.\n");
    expect(resume.experience[0]).toMatchObject({ title: "Warehouse Associate", employer: "Example Logistics Inc", startDate: "", endDate: "" });
    expect(issues.some((issue) => /No dates were found/.test(issue.message))).toBe(true);
  });
});

describe("findDates", () => {
  it.each([
    ["Engineer Jan 2020 – Present", { start: "Jan 2020", end: "Present", current: true, rest: "Engineer" }],
    ["Analyst | 03/2019 - 12/2021", { start: "03/2019", end: "12/2021", current: false, rest: "Analyst" }],
    ["Intern, Summer 2022", { start: "", end: "Summer 2022", rest: "Intern" }],
    ["B.S. Biology 2016 to 2020", { start: "2016", end: "2020", rest: "B.S. Biology" }],
  ])("parses %s", (line, expected) => {
    expect(findDates(line)).toMatchObject(expected);
  });

  it("does not treat a product version as a date range", () => {
    expect(findDates("Windows Server 2019 administration")).toBeNull();
  });
});
