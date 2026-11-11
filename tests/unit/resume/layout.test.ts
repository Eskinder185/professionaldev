import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../../src/features/resume/model/defaults";
import { parseResumeText } from "../../../src/features/resume/parse/parseResume";
import { pdfItemsToLines } from "../../../src/features/resume/parse/extract";
import { layoutResume, buildParas } from "../../../src/features/resume/layout/engine";
import { loadMeasurer } from "../../../src/features/resume/layout/measurer";
import { LIMITS } from "../../../src/features/resume/layout/templates";
import { exportPdf, OnePageOverflowError } from "../../../src/features/resume/document/exportPdf";
import { uid } from "../../../src/features/resume/model/defaults";
import type { Resume, TemplateId } from "../../../src/features/resume/model/types";
import { CLASSIC_RESUME } from "../../fixtures/resumes";

const { resume } = parseResumeText(CLASSIC_RESUME);

/** A synthetic résumé that cannot fit on one page. */
function longResume(): Resume {
  const base = structuredClone(resume);
  base.experience = Array.from({ length: 6 }, (_, i) => ({
    id: uid(),
    title: `Systems Engineer ${i + 1}`,
    employer: `Employer ${i + 1} Technology Group`,
    location: "Austin, TX",
    startDate: "Jan 2010",
    endDate: "Dec 2012",
    current: false,
    bullets: Array.from({ length: 5 }, (_, b) => `Delivered measurable infrastructure improvement number ${b + 1} for project ${i + 1}, coordinating with several teams across multiple sites to reduce incidents and improve reliability for users.`),
  }));
  return base;
}

describe("layout engine", () => {
  it("fits the sample résumé on one page and reports it", async () => {
    const measure = await loadMeasurer();
    const layout = layoutResume(resume, defaultSettings(), measure);
    expect(layout.fit.fitsOnePage).toBe(true);
    expect(layout.fit.label).toBe("Page Fit: 1 of 1");
    expect(layout.pages).toHaveLength(1);
  });

  it("measures real wrapping: no line exceeds the content width and lines never overlap", async () => {
    const measure = await loadMeasurer();
    for (const template of ["classic", "technical", "modern"] as TemplateId[]) {
      const layout = layoutResume(longResume(), defaultSettings(template), measure);
      const { marginPt, widthPt } = layout.page;
      for (const page of layout.pages) {
        let previousBottom = 0;
        for (const line of page.lines) {
          for (const run of line.runs) expect(run.x + run.width).toBeLessThanOrEqual(widthPt - marginPt + 0.5);
          expect(line.y).toBeGreaterThanOrEqual(previousBottom - 0.01);
          previousBottom = line.y + line.height;
          expect(line.y + line.height).toBeLessThanOrEqual(layout.page.heightPt - marginPt + 0.5);
        }
      }
    }
  });

  it("reports overflow in lines instead of claiming a fit", async () => {
    const measure = await loadMeasurer();
    const layout = layoutResume(longResume(), defaultSettings(), measure);
    expect(layout.fit.fitsOnePage).toBe(false);
    expect(layout.fit.overflowLines).toBeGreaterThan(5);
    expect(layout.fit.label).toMatch(/^Over limit: \d+ lines/);
    expect(layout.pages.length).toBeGreaterThan(1);
  });

  it("never lays text out below the readable minimum, even if settings ask for it", async () => {
    const measure = await loadMeasurer();
    const layout = layoutResume(resume, { ...defaultSettings(), fontSize: 7, margin: 0.2 }, measure);
    const bodySizes = layout.pages[0].lines.filter((line) => line.paraKind === "bullet").map((line) => line.size);
    expect(Math.min(...bodySizes)).toBeGreaterThanOrEqual(LIMITS.fontMin);
    expect(layout.page.marginPt).toBeGreaterThanOrEqual(LIMITS.marginMin * 72);
    expect(layout.readability.ok).toBe(false);
  });

  it("keeps all content when switching templates or hiding sections", async () => {
    const words = (template: TemplateId) =>
      buildParas(resume, defaultSettings(template))
        .flatMap((para) => [...para.runs, ...(para.right ?? [])])
        .map((run) => run.text)
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9+]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .sort();
    expect(words("technical")).toEqual(words("classic"));
    expect(words("modern")).toEqual(words("classic"));
    const hidden = buildParas(resume, { ...defaultSettings(), hiddenSections: ["awards"] }).some((para) => para.section === "awards");
    expect(hidden).toBe(false);
    expect(resume.awards.length).toBeGreaterThan(0);
  });
});

describe("PDF export matches the layout", () => {
  it("blocks a one-page export that overflows", async () => {
    await expect(exportPdf(longResume(), defaultSettings())).rejects.toBeInstanceOf(OnePageOverflowError);
  });

  it("writes exactly one page of selectable text at readable sizes, and re-imports", async () => {
    const result = await exportPdf(resume, defaultSettings());
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(result.bytes), useSystemFonts: true }).promise;
    expect(doc.numPages).toBe(1);
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    expect([viewport.width, viewport.height]).toEqual([612, 792]);
    const content = await page.getTextContent();
    const items = (content.items as Array<{ str: string; transform: number[]; width: number }>)
      .filter((item) => item.str.trim())
      .map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, size: Math.abs(item.transform[0]) }));
    const body = items.filter((item) => item.str.length > 12);
    expect(Math.min(...body.map((item) => item.size))).toBeGreaterThanOrEqual(10);
    for (const item of items) {
      expect(item.x).toBeGreaterThanOrEqual(0.5 * 72 - 0.5);
      expect(item.x + item.width).toBeLessThanOrEqual(612 - 0.5 * 72 + 1);
      expect(item.y).toBeGreaterThan(0.5 * 72 - 8);
    }
    const again = parseResumeText(pdfItemsToLines(items).join("\n")).resume;
    expect(again.contact.name).toBe("Jordan Rivera");
    expect(again.experience.map((entry) => [entry.employer || entry.title, entry.bullets.length])).toEqual(resume.experience.map((entry) => [entry.employer || entry.title, entry.bullets.length]));
    expect(again.education).toHaveLength(resume.education.length);
    expect(again.certifications.map((cert) => cert.name)).toEqual(resume.certifications.map((cert) => cert.name));
  });
});
