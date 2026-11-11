import type { PdfFamily, Style } from "./types";

/** Text width in points for a string set in a standard PDF font. */
export type Measurer = (text: string, family: PdfFamily, style: Style, size: number) => number;

let cached: Promise<Measurer> | null = null;
let loadedMeasurer: Measurer | null = null;

/** Synchronous fallback measurer used when layoutResume is called synchronously before loadMeasurer() resolves. */
export const defaultMeasurer: Measurer = (text, family, style, size) => {
  if (loadedMeasurer) return loadedMeasurer(text, family, style, size);
  if (!text) return 0;
  let units = 0;
  for (const ch of text) {
    if ("ilI.,:;!|'` ".includes(ch)) units += 0.28;
    else if ("mwMW@%".includes(ch)) units += 0.82;
    else if (ch >= "A" && ch <= "Z") units += 0.66;
    else units += 0.52;
  }
  const boldFactor = style.includes("bold") ? 1.06 : 1;
  const familyFactor = family === "times" ? 0.95 : 1;
  return units * size * boldFactor * familyFactor;
};

/**
 * Metrics come from jsPDF's built-in Helvetica and Times AFM tables, the same
 * tables used when the PDF is written. Arial and Times New Roman are metric
 * compatible with them, so preview, PDF and Word wrap at the same places.
 */
export function loadMeasurer(): Promise<Measurer> {
  cached ??= import("jspdf").then(({ jsPDF }) => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const memo = new Map<string, number>();
    const fn: Measurer = (text, family, style, size) => {
      if (!text) return 0;
      const key = `${family}|${style}|${size}|${text}`;
      const hit = memo.get(key);
      if (hit !== undefined) return hit;
      doc.setFont(family, style);
      doc.setFontSize(size);
      // System Arial Bold is ~2% wider than PDF's built-in Helvetica Bold AFM table; pad bold runs so transitions never collide.
      const factor = family === "helvetica" && style.includes("bold") ? 1.02 : 1;
      const width = doc.getTextWidth(text) * factor;
      if (memo.size > 20000) memo.clear();
      memo.set(key, width);
      return width;
    };
    loadedMeasurer = fn;
    return fn;
  });
  return cached;
}
