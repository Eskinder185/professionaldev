import JSZip from "jszip";
import { jsPDF } from "jspdf";

/** Build a real, text-selectable PDF résumé with right-aligned dates and bullet glyphs. */
export function buildResumePdf(): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = 60;
  const left = 54;
  const right = 558;
  const line = (text: string, options: { size?: number; bold?: boolean; x?: number; align?: "right" } = {}) => {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(options.size ?? 10.5);
    doc.text(text, options.align === "right" ? right : options.x ?? left, y, options.align === "right" ? { align: "right" } : undefined);
  };
  const next = (gap = 14) => (y += gap);
  line("Morgan Ellis", { size: 20, bold: true });
  next(18);
  line("Denver, CO | morgan.ellis@example.com | 303-555-0199 | github.com/mellis");
  next(26);
  line("EXPERIENCE", { size: 12, bold: true });
  next(16);
  line("Network Administrator", { bold: true });
  line("Mar 2021 - Present", { align: "right" });
  next();
  line("Front Range Credit Union, Denver, CO");
  next();
  for (const bullet of ["Maintained 40 Cisco switches and documented VLAN changes.", "Reduced Wi-Fi outages by 30% after replacing aging access points."]) {
    line("•", { x: left + 6 });
    line(bullet, { x: left + 18 });
    next();
  }
  next(4);
  line("IT Technician", { bold: true });
  line("Jun 2019 - Feb 2021", { align: "right" });
  next();
  line("Peak Systems Group, Boulder, CO");
  next();
  line("•", { x: left + 6 });
  line("Resolved hardware and software tickets for 150 staff.", { x: left + 18 });
  next(26);
  line("SKILLS", { size: 12, bold: true });
  next(16);
  line("Networking: Cisco IOS, VLANs, OSPF, DNS");
  next();
  line("Scripting: Python, Bash");
  next(26);
  line("EDUCATION", { size: 12, bold: true });
  next(16);
  line("Metropolitan State University of Denver", { bold: true });
  line("May 2019", { align: "right" });
  next();
  line("Bachelor of Science in Computer Information Systems");
  return Buffer.from(doc.output("arraybuffer"));
}

const xmlEscape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Build a minimal DOCX with headings, a tab before dates, and bullet paragraphs. */
export async function buildResumeDocx(): Promise<Buffer> {
  const paragraphs = [
    "Casey Brooks",
    "casey.brooks@example.com | 614-555-0110 | Columbus, OH",
    "Professional Summary",
    "Help desk analyst who documents fixes and keeps users informed.",
    "Experience",
    "Help Desk Analyst | Buckeye Insurance Group\tAug 2022 – Present",
    "• Answered 60 calls per day with a 92% first-contact resolution rate.",
    "• Wrote onboarding guides for password resets and VPN setup.",
    "Education",
    "Columbus State Community College",
    "Associate of Science in Information Technology\tMay 2022",
  ];
  const body = paragraphs
    .map((text) => {
      const runs = text.split("\t").map((part, index) => `${index ? "<w:r><w:tab/></w:r>" : ""}<w:r><w:t xml:space="preserve">${xmlEscape(part)}</w:t></w:r>`).join("");
      return `<w:p>${runs}</w:p>`;
    })
    .join("");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}
