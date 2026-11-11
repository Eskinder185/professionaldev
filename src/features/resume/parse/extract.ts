/**
 * File → text extraction that preserves line structure.
 *
 * The earlier extractor joined every PDF text item with a space and ended a
 * line only at page boundaries, and used DOCX raw text that drops list
 * markers. Both destroyed the headings/bullets the parser relies on.
 */

export type PdfTextItem = { str: string; x: number; y: number; width: number; size: number; hasEOL?: boolean };

export type ExtractedResume = {
  kind: "pdf" | "docx" | "txt";
  text: string;
  pageCount?: number;
  warnings: string[];
};

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Rebuild reading-order lines from positioned PDF text items on one page. */
export function pdfItemsToLines(items: PdfTextItem[]): string[] {
  const usable = items.filter((item) => item.str.length > 0);
  if (!usable.length) return [];
  const bodySize = median(usable.map((item) => item.size).filter((size) => size > 0)) || 10;
  // PDF y grows upward: sort top-to-bottom, then left-to-right.
  const sorted = [...usable].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of sorted) {
    const tolerance = Math.max(2, (item.size || bodySize) * 0.45);
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  rows.sort((a, b) => b.y - a.y);
  const lines: string[] = [];
  let previousY: number | null = null;
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    let text = "";
    let end: number | null = null;
    let pending = "" as "" | " " | "\t";
    for (const item of row.items) {
      const size = item.size || bodySize;
      if (!item.str.trim()) {
        // PDF.js reports gaps as whitespace items whose width spans the gap (e.g. before right-aligned dates).
        if (end !== null) pending = item.width > bodySize * 2.5 || pending === "\t" ? "\t" : " ";
        continue;
      }
      if (end !== null) {
        const gap = item.x - end;
        if (pending === "\t" || gap > size * 2.5) text += "\t";
        else if ((pending === " " || gap > size * 0.12) && !text.endsWith(" ") && !item.str.startsWith(" ")) text += " ";
      }
      pending = "";
      text += item.str;
      end = item.x + item.width;
    }
    if (previousY !== null && previousY - row.y > bodySize * 2.1) lines.push("");
    lines.push(text.replace(/[ ]{2,}/g, " ").trimEnd());
    previousY = row.y;
  }
  return lines;
}

/** Convert mammoth's HTML into lines, keeping list items as bullets. */
export function docxHtmlToLines(html: string): string[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const lines: string[] = [];
  const ownText = (element: Element) =>
    Array.from(element.childNodes)
      .filter((node) => !(node instanceof Element && /^(UL|OL)$/.test(node.tagName)))
      .map((node) => node.textContent || "")
      .join("")
      .replace(/[ ]{2,}/g, " ")
      .trim();
  const walkList = (list: Element) => {
    for (const li of Array.from(list.children)) {
      if (li.tagName !== "LI") continue;
      const text = ownText(li);
      if (text) lines.push(`• ${text}`);
      for (const nested of Array.from(li.children)) if (/^(UL|OL)$/.test(nested.tagName)) walkList(nested);
    }
  };
  const walk = (element: Element) => {
    for (const child of Array.from(element.children)) {
      const tag = child.tagName;
      if (tag === "UL" || tag === "OL") walkList(child);
      else if (tag === "TABLE") {
        for (const row of Array.from(child.querySelectorAll("tr"))) {
          const cells = Array.from(row.querySelectorAll("td,th")).map((cell) => cell.textContent?.trim() || "").filter(Boolean);
          if (cells.length) lines.push(cells.join("\t"));
        }
      } else if (/^(P|H[1-6]|DIV|BLOCKQUOTE)$/.test(tag)) {
        const text = (child.textContent || "").replace(/[ ]{2,}/g, " ").trim();
        lines.push(text);
      } else walk(child);
    }
  };
  walk(doc.body);
  // Collapse runs of empty paragraphs to a single blank line.
  return lines.filter((line, index) => line || (index > 0 && lines[index - 1] !== ""));
}

export async function extractResumeFile(file: File): Promise<ExtractedResume> {
  const extension = (file.name.split(".").pop() || "").toLowerCase();
  const warnings: string[] = [];

  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    await import("pdfjs-dist/build/pdf.worker.min.mjs");
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const raw of content.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number; hasEOL?: boolean }>) {
        if (typeof raw.str !== "string") continue;
        const transform = raw.transform || [1, 0, 0, 1, 0, 0];
        const size = raw.height || Math.hypot(transform[2], transform[3]) || Math.abs(transform[0]);
        items.push({ str: raw.str, x: transform[4], y: transform[5], width: raw.width || 0, size, hasEOL: raw.hasEOL });
      }
      pages.push(pdfItemsToLines(items).join("\n"));
    }
    const text = pages.join("\n\n").trim();
    if (!text) warnings.push("No selectable text was found. The PDF may be a scanned image; paste the text instead.");
    return { kind: "pdf", text, pageCount: pdf.numPages, warnings };
  }

  if (extension === "docx") {
    const { default: mammoth } = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    let text = docxHtmlToLines(result.value).join("\n").trim();
    if (!text) {
      const raw = await mammoth.extractRawText({ arrayBuffer });
      text = (raw.value || "").trim();
    }
    if (!text) warnings.push("The document appears to be empty.");
    return { kind: "docx", text, warnings };
  }

  if (extension === "txt" || extension === "md") {
    return { kind: "txt", text: (await file.text()).trim(), warnings };
  }

  throw new Error("Unsupported file type. Upload PDF, DOCX, or TXT.");
}
