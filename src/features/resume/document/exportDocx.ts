import { effectiveOrder, FONT_STACKS, PAPER } from "../model/defaults";
import type { DocumentSettings, Resume } from "../model/types";
import { sectionTitle } from "./blocks";
import { zipStore } from "./zip";

/**
 * DOCX export built from the structured résumé: real Word headings, real
 * bulleted lists (numbering definitions), and right tab stops for dates.
 * Single column, no tables or text boxes, so text keeps a simple reading order.
 */

const esc = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Strip characters that are invalid in XML 1.0 (matching control characters is the point here).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "");

const run = (text: string, props = "") => (text ? `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>` : "");

export function buildDocumentXml(resume: Resume, settings: DocumentSettings): string {
  const paper = PAPER[settings.paper];
  const twips = (inches: number) => Math.round(inches * 1440);
  const contentWidth = twips(paper.widthIn - settings.margin * 2);
  const body: string[] = [];
  const center = settings.headerLayout === "center";
  const para = (runs: string, props = "") => body.push(`<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${runs}</w:p>`);
  const tabbed = (leftText: string, rightText: string, leftProps: string, rightProps = "") =>
    para(`${run(leftText, leftProps)}${rightText ? `<w:r><w:tab/></w:r>${run(rightText, rightProps)}` : ""}`, `<w:tabs><w:tab w:val="right" w:pos="${contentWidth}"/></w:tabs><w:spacing w:before="0" w:after="0"/>`);
  const bullet = (text: string) => para(run(text), `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:before="0" w:after="20"/>`);
  const heading = (title: string) => para(run(settings.template === "modern" ? title : title.toUpperCase()), `<w:pStyle w:val="Heading1"/>`);
  const range = (start: string, end: string) => [start, end].filter(Boolean).join(" – ");

  const { contact } = resume;
  const align = center ? `<w:jc w:val="center"/>` : "";
  if (contact.name) para(run(contact.name), `<w:pStyle w:val="Title"/>${align}`);
  if (contact.headline) para(run(contact.headline), `${align}<w:spacing w:after="0"/>`);
  for (const line of [[contact.location, contact.phone, contact.email], [contact.linkedin, contact.github, contact.website, ...contact.other]]) {
    const text = line.filter(Boolean).join("  |  ");
    if (text) para(run(text, `<w:sz w:val="${Math.round(settings.fontSize * 1.86)}"/>`), `${align}<w:spacing w:after="0"/>`);
  }

  for (const key of effectiveOrder(resume, settings)) {
    const title = sectionTitle(key, resume);
    switch (key) {
      case "summary":
        if (!resume.summary.trim()) break;
        heading(title);
        para(run(resume.summary));
        break;
      case "skills": {
        const categories = resume.skills.filter((category) => category.skills.length);
        if (!categories.length) break;
        heading(title);
        categories.forEach((category) => para(`${category.name ? run(`${category.name}: `, "<w:b/>") : ""}${run(category.skills.join(", "))}`, `<w:spacing w:after="20"/>`));
        break;
      }
      case "experience":
        if (!resume.experience.length) break;
        heading(title);
        resume.experience.forEach((entry) => {
          tabbed(entry.title || entry.employer, range(entry.startDate, entry.current ? "Present" : entry.endDate), "<w:b/>");
          if (entry.title && (entry.employer || entry.location)) tabbed(entry.employer, entry.location, "<w:i/>", "<w:i/>");
          entry.bullets.filter((text) => text.trim()).forEach(bullet);
        });
        break;
      case "projects":
        if (!resume.projects.length) break;
        heading(title);
        resume.projects.forEach((entry) => {
          tabbed(entry.name, range(entry.startDate, entry.endDate), "<w:b/>");
          const sub = [entry.role, entry.technologies.join(", ")].filter(Boolean).join(" · ");
          const links = [entry.githubUrl, entry.liveUrl].filter(Boolean).join("  |  ");
          if (sub || links) tabbed(sub, links, "<w:i/>", "<w:i/>");
          if (entry.description.trim()) para(run(entry.description), `<w:spacing w:after="20"/>`);
          entry.bullets.filter((text) => text.trim()).forEach(bullet);
        });
        break;
      case "education":
        if (!resume.education.length) break;
        heading(title);
        resume.education.forEach((entry) => {
          const degree = [entry.degree, entry.field].filter(Boolean).join(", ");
          tabbed(entry.institution || degree, range(entry.startDate, entry.endDate), "<w:b/>");
          const sub = [entry.institution ? degree : "", entry.gpa && `GPA ${entry.gpa}`].filter(Boolean).join(" · ");
          if (sub || entry.location) tabbed(sub, entry.location, "<w:i/>", "<w:i/>");
          entry.details.filter((text) => text.trim()).forEach(bullet);
        });
        break;
      case "certifications":
        if (!resume.certifications.length) break;
        heading(title);
        resume.certifications.forEach((cert) => tabbed([cert.name, cert.issuer].filter(Boolean).join(", ") + (cert.credentialId ? ` (Credential ID ${cert.credentialId})` : ""), cert.date, ""));
        break;
      case "awards":
      case "publications": {
        const items = resume[key].map((item) => item.text).filter((text) => text.trim());
        if (!items.length) break;
        heading(title);
        items.forEach(bullet);
        break;
      }
      default: {
        const section = resume.custom.find((custom) => `custom:${custom.id}` === key);
        const items = section?.items.map((item) => item.text).filter((text) => text.trim()) ?? [];
        if (!items.length) break;
        heading(title);
        items.forEach(bullet);
      }
    }
  }

  const pageW = twips(paper.widthIn);
  const pageH = twips(paper.heightIn);
  const margin = twips(settings.margin);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="${pageW}" w:h="${pageH}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function stylesXml(settings: DocumentSettings) {
  const font = FONT_STACKS[settings.font].label;
  const size = Math.round(settings.fontSize * 2);
  const accent = settings.template === "modern" ? "1F3A5F" : "000000";
  const headingBorder = settings.template === "technical" ? `<w:pBdr><w:left w:val="single" w:sz="18" w:space="4" w:color="111111"/></w:pBdr>` : `<w:pBdr><w:bottom w:val="single" w:sz="${settings.template === "modern" ? 8 : 6}" w:space="1" w:color="${settings.template === "modern" ? "C5D1E0" : "000000"}"/></w:pBdr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="20"/></w:pPr><w:rPr><w:b/><w:color w:val="${accent}"/><w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${Math.round(settings.sectionSpacing * 20)}" w:after="60"/>${headingBorder}<w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="${accent}"/><w:sz w:val="${Math.round(size * (settings.template === "modern" ? 1.2 : 1.08))}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="${Math.round(settings.bulletIndent * 20)}"/></w:pPr></w:style>
</w:styles>`;
}

function numberingXml(settings: DocumentSettings) {
  const left = Math.round(settings.bulletIndent * 20);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${left}" w:hanging="${Math.min(left, 200)}"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
}

export function exportDocx(resume: Resume, settings: DocumentSettings): Uint8Array {
  const title = esc(resume.contact.name || "Résumé");
  return zipStore([
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: "docProps/core.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>${title}</dc:creator></cp:coreProperties>` },
    { name: "word/_rels/document.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>` },
    { name: "word/document.xml", data: buildDocumentXml(resume, settings) },
    { name: "word/styles.xml", data: stylesXml(settings) },
    { name: "word/numbering.xml", data: numberingXml(settings) },
  ]);
}
