import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker.min.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist";

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = (file.name.toLowerCase().split(".").pop() || "").trim();
  if (ext === "pdf") {
    const ab = await file.arrayBuffer();
    const pdf = (await (pdfjsLib as any).getDocument({ data: ab }).promise) as PDFDocumentProxy;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const c = await page.getTextContent();
      text += (c.items as any[]).map((it: any) => ("str" in it ? it.str : (it?.text || ""))).join(" ") + "\n";
    }
    return text;
  } else if (ext === "docx") {
    const { default: mammoth } = await import("mammoth");
    const ab = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: ab } as any);
    return (res as any).value || "";
  } else if (ext === "txt" || ext === "md") {
    return await file.text();
  } else {
    throw new Error("Unsupported file type. Please upload PDF, DOCX, or TXT.");
  }
}

