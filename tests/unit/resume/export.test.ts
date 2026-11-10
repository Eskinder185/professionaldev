import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import mammoth from "mammoth";
import { defaultSettings } from "../../../src/features/resume/model/defaults";
import { parseResumeText } from "../../../src/features/resume/parse/parseResume";
import { docxHtmlToLines } from "../../../src/features/resume/parse/extract";
import { buildDocumentXml, exportDocx } from "../../../src/features/resume/document/exportDocx";
import { sanitizeForPdf } from "../../../src/features/resume/document/exportPdf";
import { crc32, zipStore } from "../../../src/features/resume/document/zip";
import { CLASSIC_RESUME } from "../../fixtures/resumes";

const { resume } = parseResumeText(CLASSIC_RESUME);

describe("zip writer", () => {
  it("computes standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });

  it("produces archives other tools can read", async () => {
    const zip = await JSZip.loadAsync(zipStore([{ name: "a.txt", data: "hello" }, { name: "dir/é.xml", data: "<x/>" }]));
    expect(await zip.file("a.txt")!.async("string")).toBe("hello");
    expect(await zip.file("dir/é.xml")!.async("string")).toBe("<x/>");
  });
});

describe("DOCX export", () => {
  it("uses real headings, bullet numbering, right tab stops, and the chosen page size", () => {
    const xml = buildDocumentXml(resume, { ...defaultSettings(), paper: "a4" });
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(xml).toContain('<w:numId w:val="1"/>');
    expect(xml).toContain('<w:tab w:val="right"');
    expect(xml).toContain('<w:pgSz w:w="11909" w:h="16834"/>');
    expect(xml).not.toContain("<w:tbl>");
  });

  it("re-imports with headings, bullets, and dates attached to the right entries", async () => {
    const bytes = exportDocx(resume, defaultSettings());
    const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
    expect(value).toContain("<ul>");
    const text = docxHtmlToLines(value).join("\n");
    const again = parseResumeText(text).resume;
    expect(again.contact.name).toBe("Jordan Rivera");
    expect(again.experience.map((entry) => [entry.title, entry.employer, entry.location, entry.startDate, entry.endDate, entry.bullets.length])).toEqual(
      resume.experience.map((entry) => [entry.title, entry.employer, entry.location, entry.startDate, entry.endDate, entry.bullets.length]),
    );
    expect(again.education[0]).toMatchObject({ institution: "Austin Community College", endDate: "May 2020" });
    expect(again.certifications.map((cert) => cert.name)).toEqual(["CompTIA A+", "CompTIA Network+"]);
    expect(again.skills.map((category) => category.name)).toEqual(resume.skills.map((category) => category.name));
  });

  it("escapes XML-sensitive characters", () => {
    const xml = buildDocumentXml({ ...resume, summary: "R&D <lead> \"quoted\"" }, defaultSettings());
    expect(xml).toContain("R&amp;D &lt;lead&gt; &quot;quoted&quot;");
  });
});

describe("PDF text sanitizing", () => {
  it("keeps Western European characters and reports unsupported ones", () => {
    const replaced = new Set<string>();
    expect(sanitizeForPdf("Résumé – “Zoë” • 50€", replaced)).toBe("Résumé – “Zoë” • 50€");
    expect(sanitizeForPdf("Łódź 東京", replaced)).toBe("?ód? ??");
    expect([...replaced]).toEqual(expect.arrayContaining(["Ł", "ź", "東"]));
  });
});
