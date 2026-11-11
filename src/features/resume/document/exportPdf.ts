import type { jsPDF as JsPDF } from "jspdf";
import type { DocumentSettings, Resume } from "../model/types";
import { loadMeasurer } from "../layout/measurer";
import { layoutResume, sanitizeText } from "../layout/engine";
import type { LayoutResult } from "../layout/types";

/**
 * Text-based PDF export (selectable, searchable text, not a screenshot).
 * Every line is drawn at the position the layout engine computed for the
 * preview, so the PDF paginates exactly like the document on screen.
 */

export function sanitizeForPdf(text: string, replaced: Set<string>): string {
  return sanitizeText(text, replaced);
}

export type PdfExport = { bytes: ArrayBuffer; warnings: string[]; layout: LayoutResult };

/** Thrown when a one-page export is requested but the content does not fit. */
export class OnePageOverflowError extends Error {
  constructor(public readonly overflowLines: number) {
    super(`The résumé is over the one-page limit by ${overflowLines} line${overflowLines === 1 ? "" : "s"}. Resolve the overflow or choose to allow multiple pages.`);
    this.name = "OnePageOverflowError";
  }
}

export const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  const n = parseInt(value.length === 3 ? value.replace(/./g, "$&$&") : value, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Draw an already computed layout into a jsPDF document. */
export function drawLayout(doc: JsPDF, layout: LayoutResult) {
  layout.pages.forEach((page, index) => {
    if (index) doc.addPage();
    for (const rule of page.rules) {
      doc.setDrawColor(...hexToRgb(rule.color));
      doc.setLineWidth(rule.width);
      doc.line(rule.x1, rule.y, rule.x2, rule.y);
    }
    for (const line of page.lines) {
      doc.setFontSize(line.size);
      doc.setTextColor(...hexToRgb(line.color ?? "#000000"));
      if (line.glyph) {
        doc.setFont(layout.family, "normal");
        doc.text(line.glyph.text, line.glyph.x, line.y + line.baseline);
      }
      for (const piece of line.runs) {
        doc.setFont(layout.family, piece.style);
        doc.text(piece.text, piece.x, line.y + line.baseline);
      }
    }
  });
  doc.setTextColor(0, 0, 0);
}

export async function exportPdf(resume: Resume, settings: DocumentSettings, options: { allowOverflow?: boolean } = {}): Promise<PdfExport> {
  const [{ jsPDF }, measure] = await Promise.all([import("jspdf"), loadMeasurer()]);
  const layout = layoutResume(resume, settings, measure);
  if (settings.pagePreference === "one" && !layout.fit.fitsOnePage && !options.allowOverflow) throw new OnePageOverflowError(layout.fit.overflowLines);
  const doc = new jsPDF({ unit: "pt", format: [layout.page.widthPt, layout.page.heightPt], compress: true });
  drawLayout(doc, layout);
  const { contact } = resume;
  doc.setProperties({ title: `${contact.name || "Résumé"}`.trim(), subject: "Résumé", creator: "ProfessionalDev CareerOS", author: contact.name || "" });
  const warnings = layout.replacedChars.length
    ? [`${layout.replacedChars.length} character${layout.replacedChars.length === 1 ? "" : "s"} outside the standard PDF font set were replaced with “?”: ${layout.replacedChars.slice(0, 8).join(" ")}. Use DOCX export to keep them.`]
    : [];
  return { bytes: doc.output("arraybuffer"), warnings, layout };
}
