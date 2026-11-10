import { describe, expect, it } from "vitest";
import { analyzeResume } from "../../src/utils/analyzeResume";

describe("analyzeResume", () => {
  it("detects contact details, sections, metrics, and target keywords in text", () => {
    const text = [
      "Jane Developer",
      "Boston, MA",
      "jane@example.com",
      "https://github.com/jane",
      "https://www.linkedin.com/in/jane",
      "Summary",
      "Skills: TypeScript React",
      "Experience",
      "- Built an accessible React application and improved completion by 35%.",
      "- Automated tests for 120 workflows.",
      "Education",
      "Projects",
    ].join("\n");

    const result = analyzeResume({ kind: "txt", text }, ["TypeScript", "React"]);

    expect(result.detected.emails).toContain("jane@example.com");
    expect(result.detected.linkedin).toBe("https://www.linkedin.com/in/jane");
    expect(result.detected.sections).toMatchObject({
      experience: true,
      education: true,
      projects: true,
      skills: true,
      summary: true,
    });
    expect(result.breakdown.find(({ label }) => label === "Metrics")?.note).toBe("Quantified impact");
    expect(result.typography.available).toBe(false);
  });

  it("derives basic typography signals for PDF text items", () => {
    const result = analyzeResume({
      kind: "pdf",
      text: "Summary\nBuilt reliable software.",
      items: [
        { str: "Summary", y: 120, size: 16, font: "HeadingFont" },
        { str: "Built reliable", y: 100, size: 11, font: "BodyFont" },
        { str: "software", y: 87, size: 11, font: "BodyFont" },
      ],
    });

    expect(result.typography).toMatchObject({
      available: true,
      bodySizePt: 11,
      headingSizesPt: [16],
      lineSpacingRatio: 1.2,
    });
    expect(result.typography.fontCandidates).toEqual(["HeadingFont", "BodyFont"]);
  });
});
