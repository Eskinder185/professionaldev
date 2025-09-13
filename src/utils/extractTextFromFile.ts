import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.min.mjs";

export type Extracted =
  | { kind: "pdf"; text: string; items: Array<{ str: string; y: number; size: number; font?: string }> }
  | { kind: "docx" | "txt"; text: string };

export async function extractTextFromFile(file: File): Promise<Extracted> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  if (ext === "pdf") {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    let text = "";
    const items: Array<{ str: string; y: number; size: number; font?: string }> = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Y descends down the page for PDF.js; transform[5] is y, transform[0]/[3] carry scale
      for (const it of content.items as any[]) {
        if (!("str" in it)) continue;
        const str: string = it.str;
        const t: number[] = it.transform || [1,0,0,1,0,0];
        const y = t[5] ?? 0;
        // Use height if present; else fall back to |a| scale
        const size = typeof it.height === "number" ? it.height : Math.abs(t[0] || 0) || Math.abs(t[3] || 0) || 0;
        const font = (it as any).fontName;
        items.push({ str, y, size, font });
        text += str + " ";
      }
      text += "\n";
    }
    return { kind: "pdf", text: text.replace(/[ \t]+\n/g, "\n"), items };
  }

  if (ext === "docx") {
    const { default: mammoth } = await import("mammoth");
    const ab = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: ab });
    return { kind: "docx", text: (res.value || "").trim() };
  }

  if (ext === "txt" || ext === "md") {
    return { kind: "txt", text: (await file.text()).trim() };
  }

  throw new Error("Unsupported file type. Upload PDF, DOCX, or TXT.");
}

