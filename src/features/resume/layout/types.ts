import type { SectionKey } from "../model/types";

export type PdfFamily = "helvetica" | "times";
export type Style = "normal" | "bold" | "italic" | "bolditalic";
export type Run = { text: string; style: Style };

export type ParaKind =
  | "name"
  | "headline"
  | "contact"
  | "heading"
  | "summary"
  | "skill"
  | "entry"
  | "entrysub"
  | "bullet"
  | "paragraph"
  | "cert";

/**
 * A semantic paragraph. The layout engine wraps these into positioned lines
 * (preview + PDF) and the DOCX writer maps them to Word paragraphs, so every
 * format is generated from the same description.
 */
export type Para = {
  key: string;
  section?: SectionKey | "header";
  kind: ParaKind;
  runs: Run[];
  /** Right-aligned text on the first line (dates). */
  right?: Run[];
  size: number;
  align: "left" | "center";
  /** Left indent of the text, in points from the margin. */
  indent: number;
  /** Bullet glyph drawn left of the text. */
  glyph?: { text: string; x: number };
  before: number;
  after: number;
  /** Line pitch as a multiple of font size. */
  lineFactor: number;
  keepNext?: boolean;
  /** Horizontal rule drawn below the last line. */
  rule?: { color: string; width: number; gap: number };
  color?: string;
};

export type PlacedRun = { text: string; style: Style; x: number; width: number };

export type PlacedLine = {
  key: string;
  paraKind: ParaKind;
  section?: SectionKey | "header";
  runs: PlacedRun[];
  /** Top of the line box, in points from the top of the page. */
  y: number;
  height: number;
  baseline: number;
  size: number;
  color?: string;
  glyph?: { text: string; x: number };
};

export type PlacedRule = { y: number; x1: number; x2: number; width: number; color: string };

export type LayoutPage = { lines: PlacedLine[]; rules: PlacedRule[] };

export type FitReport = {
  pageCount: number;
  fitsOnePage: boolean;
  /** Total wrapped lines across all pages. */
  totalLines: number;
  /** Lines that fall past the first page's bottom margin. 0 when it fits. */
  overflowLines: number;
  overflowPt: number;
  usedPt: number;
  availablePt: number;
  /** Used height as a fraction of the available height on page one. */
  fillRatio: number;
  /** Plain-language status such as "Page Fit: 1 of 1" or "Over limit: 6 lines". */
  label: string;
};

export type ReadabilityIssue = { id: string; message: string };

export type LayoutResult = {
  pages: LayoutPage[];
  paras: Para[];
  fit: FitReport;
  readability: { ok: boolean; issues: ReadabilityIssue[] };
  page: { widthPt: number; heightPt: number; marginPt: number };
  family: PdfFamily;
  /** Characters the standard PDF fonts cannot show; they are replaced and reported. */
  replacedChars: string[];
};
