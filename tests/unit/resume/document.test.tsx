import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import ResumeDocument, { paginate } from "../../../src/features/resume/document/ResumeDocument";
import { exportPlainText } from "../../../src/features/resume/document/exportText";
import { defaultSettings } from "../../../src/features/resume/model/defaults";
import { LEGACY_VERSIONS_KEY, loadVersions } from "../../../src/features/resume/model/storage";
import { parseResumeText } from "../../../src/features/resume/parse/parseResume";
import { docxHtmlToLines, pdfItemsToLines } from "../../../src/features/resume/parse/extract";
import { documentChecks } from "../../../src/features/resume/review/checks";
import { CLASSIC_RESUME } from "../../fixtures/resumes";

describe("ResumeDocument", () => {
  const { resume } = parseResumeText(CLASSIC_RESUME);

  it("renders real headings and bullet lists instead of one paragraph", () => {
    render(<ResumeDocument resume={resume} settings={defaultSettings()} zoom={1} />);
    const page = screen.getByRole("article", { name: "Page 1 of 1" });
    expect(within(page).getByRole("heading", { level: 1, name: "Jordan Rivera" })).toBeInTheDocument();
    const headings = within(page).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Professional Summary", "Technical Skills", "Experience", "Projects", "Education", "Certifications", "Awards"]);
    const lists = within(page).getAllByRole("list");
    expect(lists.length).toBeGreaterThanOrEqual(4);
    expect(within(lists[0]).getAllByRole("listitem")).toHaveLength(3);
    expect(within(page).getByText("Jan 2022 – Present")).toBeInTheDocument();
  });

  it("follows the chosen section order and template", () => {
    const settings = { ...defaultSettings("technical") };
    const { container } = render(<ResumeDocument resume={resume} settings={settings} zoom={1} />);
    expect(container.querySelector(".rd-tpl-technical")).not.toBeNull();
    const headings = within(screen.getByRole("article")).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings.slice(0, 4)).toEqual(["Professional Summary", "Technical Skills", "Projects", "Experience"]);
  });
});

describe("paginate", () => {
  const blocks = [{ keepWithNext: false }, { keepWithNext: true }, { keepWithNext: false }, { keepWithNext: false }];

  it("moves blocks that overflow to the next page", () => {
    expect(paginate(blocks, [0, 100, 120, 900], [100, 120, 900, 1000], 950)).toEqual([[0, 1, 2], [3]]);
  });

  it("keeps a heading with the block that follows it", () => {
    expect(paginate(blocks, [0, 880, 900, 1000], [880, 900, 980, 1100], 950)).toEqual([[0], [1, 2, 3]]);
  });

  it("never loops on a block taller than a page", () => {
    expect(paginate([{}, {}], [0, 10], [10, 3000], 950)).toEqual([[0], [1]]);
  });
});

describe("extraction helpers", () => {
  it("rebuilds PDF lines from positioned items instead of one long paragraph", () => {
    const lines = pdfItemsToLines([
      { str: "EXPERIENCE", x: 50, y: 700, width: 70, size: 12 },
      { str: "Analyst", x: 50, y: 684, width: 40, size: 10 },
      { str: "Jan 2020 – Present", x: 450, y: 684, width: 90, size: 10 },
      { str: "•", x: 50, y: 670, width: 4, size: 10 },
      { str: "Built dashboards", x: 60, y: 670, width: 80, size: 10 },
    ]);
    expect(lines).toEqual(["EXPERIENCE", "Analyst\tJan 2020 – Present", "• Built dashboards"]);
  });

  it("converts DOCX HTML lists into bullet lines", () => {
    const lines = docxHtmlToLines("<h1>Jane Doe</h1><p>Experience</p><p>Analyst</p><ul><li>Built reports</li><li>Cut costs</li></ul><p></p><p></p><p>Education</p>");
    expect(lines).toEqual(["Jane Doe", "Experience", "Analyst", "• Built reports", "• Cut costs", "", "Education"]);
  });
});

describe("plain-text export", () => {
  it("round-trips through the parser with structure intact", () => {
    const { resume } = parseResumeText(CLASSIC_RESUME);
    const text = exportPlainText(resume, defaultSettings());
    const again = parseResumeText(text).resume;
    expect(again.contact.email).toBe(resume.contact.email);
    expect(again.experience.map((entry) => [entry.title, entry.employer, entry.startDate, entry.endDate, entry.bullets.length])).toEqual(
      resume.experience.map((entry) => [entry.title, entry.employer, entry.startDate, entry.endDate, entry.bullets.length]),
    );
    expect(again.skills.map((category) => category.name)).toEqual(resume.skills.map((category) => category.name));
    expect(again.education[0].institution).toBe("Austin Community College");
  });
});

describe("storage and checks", () => {
  it("migrates legacy text versions without touching the legacy key", () => {
    localStorage.clear();
    const legacy = JSON.stringify([{ id: "v1", name: "Old", text: CLASSIC_RESUME, createdAt: "2026-01-01T00:00:00.000Z" }]);
    localStorage.setItem(LEGACY_VERSIONS_KEY, legacy);
    const [version] = loadVersions();
    expect(version).toMatchObject({ id: "v1", name: "Old" });
    expect(version.resume.experience).toHaveLength(2);
    expect(version.source?.extractedText).toBe(CLASSIC_RESUME);
    expect(localStorage.getItem(LEGACY_VERSIONS_KEY)).toBe(legacy);
  });

  it("reports page length without shrinking text", () => {
    const { resume } = parseResumeText(CLASSIC_RESUME);
    const checks = documentChecks(resume, { ...defaultSettings(), pagePreference: "one" }, 2);
    expect(checks.find((check) => check.id === "length")).toMatchObject({ ok: false });
    expect(checks.find((check) => check.id === "font")).toMatchObject({ ok: true, detail: "Body text is 11 pt." });
  });
});
