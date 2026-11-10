import type { jsPDF as JsPDF } from "jspdf";
import { effectiveOrder, PAPER } from "../model/defaults";
import type { DocumentSettings, Resume } from "../model/types";
import { sectionTitle } from "./blocks";

/**
 * Text-based PDF export (selectable, searchable text — not a screenshot).
 * Uses the standard PDF fonts, which cover Western European characters
 * (WinAnsi). Anything outside that set is replaced and reported.
 */

const CP1252_EXTRAS = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

export function sanitizeForPdf(text: string, replaced: Set<string>): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    const code = char.codePointAt(0) ?? 0;
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || CP1252_EXTRAS.includes(char)) out += char;
    else if (char === "\t" || char === "\n") out += " ";
    else if (char === "‐" || char === "‑" || char === "−") out += "-";
    else {
      replaced.add(char);
      out += "?";
    }
  }
  return out;
}

export type PdfExport = { bytes: ArrayBuffer; warnings: string[] };

export async function exportPdf(resume: Resume, settings: DocumentSettings): Promise<PdfExport> {
  const { jsPDF } = await import("jspdf");
  const paper = PAPER[settings.paper];
  const doc: JsPDF = new jsPDF({ unit: "pt", format: settings.paper === "a4" ? "a4" : "letter", compress: true });
  const replaced = new Set<string>();
  const clean = (text: string) => sanitizeForPdf(text, replaced);
  const family = ["times", "georgia", "garamond"].includes(settings.font) ? "times" : "helvetica";
  const size = settings.fontSize;
  const lineHeight = size * 1.32;
  const margin = settings.margin * 72;
  const pageWidth = paper.widthIn * 72;
  const pageHeight = paper.heightIn * 72;
  const left = margin;
  const right = pageWidth - margin;
  const width = right - left;
  const indent = settings.bulletIndent;
  const accent: [number, number, number] = settings.template === "modern" ? [31, 58, 95] : [0, 0, 0];
  let y = margin;

  const font = (style: "normal" | "bold" | "italic" | "bolditalic" = "normal", fontSize = size) => {
    doc.setFont(family, style);
    doc.setFontSize(fontSize);
  };
  const newPage = () => {
    doc.addPage();
    y = margin;
  };
  const ensure = (height: number) => {
    if (y + height > pageHeight - margin) newPage();
  };
  const baseline = (fontSize = size) => fontSize * 0.8;
  const wrap = (text: string, maxWidth: number) => doc.splitTextToSize(clean(text), maxWidth) as string[];

  const writeLines = (lines: string[], x: number, fontSize = size, align: "left" | "center" = "left") => {
    for (const line of lines) {
      ensure(fontSize * 1.32);
      doc.text(line, align === "center" ? pageWidth / 2 : x, y + baseline(fontSize), align === "center" ? { align: "center" } : undefined);
      y += fontSize * 1.32;
    }
  };

  // Header
  const { contact } = resume;
  const center = settings.headerLayout === "center";
  if (contact.name) {
    font("bold", size * 2);
    doc.setTextColor(...accent);
    writeLines(wrap(contact.name, width), left, size * 2, center ? "center" : "left");
    doc.setTextColor(0, 0, 0);
  }
  if (contact.headline) {
    font("normal", size * 1.05);
    writeLines(wrap(contact.headline, width), left, size * 1.05, center ? "center" : "left");
  }
  font("normal", size * 0.93);
  for (const line of [[contact.location, contact.phone, contact.email], [contact.linkedin, contact.github, contact.website, ...contact.other]]) {
    const text = line.filter(Boolean).join("  |  ");
    if (text) writeLines(wrap(text, width), left, size * 0.93, center ? "center" : "left");
  }

  const heading = (title: string) => {
    const headingSize = size * (settings.template === "modern" ? 1.2 : 1.08);
    y += settings.sectionSpacing;
    ensure(headingSize * 1.4 + lineHeight * 2);
    font("bold", headingSize);
    doc.setTextColor(...accent);
    const text = clean(settings.template === "modern" ? title : title.toUpperCase());
    if (settings.template === "technical") {
      doc.setFillColor(17, 17, 17);
      doc.rect(left, y + 1, 2.5, headingSize, "F");
      doc.text(text, left + 7, y + baseline(headingSize));
    } else doc.text(text, left, y + baseline(headingSize));
    y += headingSize * 1.2;
    if (settings.template !== "technical") {
      doc.setDrawColor(...(settings.template === "modern" ? ([197, 209, 224] as [number, number, number]) : accent));
      doc.setLineWidth(settings.template === "modern" ? 1 : 0.75);
      doc.line(left, y, right, y);
      y += 3;
    }
    doc.setTextColor(0, 0, 0);
    y += 2;
  };

  /** Two-column line: left text (wrapped if needed) and right-aligned text on the first line. */
  const splitLine = (leftText: string, rightText: string, style: "bold" | "italic" | "normal") => {
    font("normal");
    const rightWidth = rightText ? doc.getTextWidth(clean(rightText)) + 12 : 0;
    font(style);
    const lines = wrap(leftText, width - rightWidth);
    ensure(lineHeight * Math.max(1, lines.length));
    lines.forEach((line, index) => {
      font(style);
      doc.text(line, left, y + baseline());
      if (index === 0 && rightText) {
        font(style === "italic" ? "italic" : "normal");
        doc.text(clean(rightText), right, y + baseline(), { align: "right" });
      }
      y += lineHeight;
    });
  };

  const bullets = (items: string[]) => {
    font("normal");
    for (const item of items.filter((text) => text.trim())) {
      const lines = wrap(item, width - indent);
      lines.forEach((line, index) => {
        ensure(lineHeight);
        if (index === 0) doc.text("•", left + indent * 0.35, y + baseline());
        doc.text(line, left + indent, y + baseline());
        y += lineHeight;
      });
      y += 1;
    }
  };

  const paragraph = (text: string) => {
    font("normal");
    writeLines(wrap(text, width), left);
  };

  const labelled = (label: string, text: string) => {
    font("bold");
    const labelText = clean(label ? `${label}: ` : "");
    const labelWidth = label ? doc.getTextWidth(labelText) : 0;
    font("normal");
    const words = clean(text).split(" ");
    const lines: string[] = [];
    let current = "";
    let available = width - labelWidth;
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (doc.getTextWidth(candidate) > available && current) {
        lines.push(current);
        current = word;
        available = width;
      } else current = candidate;
    }
    if (current) lines.push(current);
    lines.forEach((line, index) => {
      ensure(lineHeight);
      if (index === 0 && label) {
        font("bold");
        doc.text(labelText, left, y + baseline());
        font("normal");
        doc.text(line, left + labelWidth, y + baseline());
      } else doc.text(line, left, y + baseline());
      y += lineHeight;
    });
  };

  const range = (start: string, end: string) => [start, end].filter(Boolean).join(" – ");

  for (const key of effectiveOrder(resume, settings)) {
    const title = sectionTitle(key, resume);
    switch (key) {
      case "summary":
        if (!resume.summary.trim()) break;
        heading(title);
        paragraph(resume.summary);
        break;
      case "skills": {
        const categories = resume.skills.filter((category) => category.skills.length);
        if (!categories.length) break;
        heading(title);
        categories.forEach((category) => labelled(category.name, category.skills.join(", ")));
        break;
      }
      case "experience":
        if (!resume.experience.length) break;
        heading(title);
        resume.experience.forEach((entry, index) => {
          if (index) y += 4;
          ensure(lineHeight * 3);
          splitLine(entry.title || entry.employer, range(entry.startDate, entry.current ? "Present" : entry.endDate), "bold");
          if (entry.title && (entry.employer || entry.location)) splitLine(entry.employer, entry.location, "italic");
          bullets(entry.bullets);
        });
        break;
      case "projects":
        if (!resume.projects.length) break;
        heading(title);
        resume.projects.forEach((entry, index) => {
          if (index) y += 4;
          ensure(lineHeight * 3);
          splitLine(entry.name, range(entry.startDate, entry.endDate), "bold");
          const sub = [entry.role, entry.technologies.join(", ")].filter(Boolean).join(" · ");
          const links = [entry.githubUrl, entry.liveUrl].filter(Boolean).join("  |  ");
          if (sub || links) splitLine(sub, links, "italic");
          if (entry.description.trim()) paragraph(entry.description);
          bullets(entry.bullets);
        });
        break;
      case "education":
        if (!resume.education.length) break;
        heading(title);
        resume.education.forEach((entry, index) => {
          if (index) y += 4;
          ensure(lineHeight * 2);
          const degree = [entry.degree, entry.field].filter(Boolean).join(", ");
          splitLine(entry.institution || degree, range(entry.startDate, entry.endDate), "bold");
          const sub = [entry.institution ? degree : "", entry.gpa && `GPA ${entry.gpa}`].filter(Boolean).join(" · ");
          if (sub || entry.location) splitLine(sub, entry.location, "italic");
          bullets(entry.details);
        });
        break;
      case "certifications":
        if (!resume.certifications.length) break;
        heading(title);
        resume.certifications.forEach((cert) => splitLine([cert.name, cert.issuer].filter(Boolean).join(", ") + (cert.credentialId ? ` (Credential ID ${cert.credentialId})` : ""), cert.date, "normal"));
        break;
      case "awards":
      case "publications": {
        const items = resume[key].map((item) => item.text).filter((text) => text.trim());
        if (!items.length) break;
        heading(title);
        bullets(items);
        break;
      }
      default: {
        const section = resume.custom.find((custom) => `custom:${custom.id}` === key);
        const items = section?.items.map((item) => item.text).filter((text) => text.trim()) ?? [];
        if (!items.length) break;
        heading(title);
        bullets(items);
      }
    }
  }

  doc.setProperties({ title: `${contact.name || "Résumé"}`.trim(), subject: "Résumé", creator: "ProfessionalDev CareerOS", author: contact.name || "" });
  const warnings = replaced.size ? [`${replaced.size} character${replaced.size === 1 ? "" : "s"} outside the standard PDF font set were replaced with “?”: ${[...replaced].slice(0, 8).join(" ")}. Use DOCX export or the browser's Print to PDF to keep them.`] : [];
  return { bytes: doc.output("arraybuffer"), warnings };
}
