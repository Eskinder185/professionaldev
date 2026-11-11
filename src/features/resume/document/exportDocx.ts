import { DOCX_FAMILY, effectiveSettings, FONT_FAMILY } from "../layout/templates";
import { buildParas, PAPER_PT, sanitizeText } from "../layout/engine";
import type { Para, Run } from "../layout/types";
import type { DocumentSettings, Resume } from "../model/types";
import { zipStore } from "./zip";

/**
 * DOCX export built from the same semantic paragraphs the preview and PDF use:
 * real Word headings, real bulleted lists, right tab stops for dates, exact line
 * pitch, single column, no tables or text boxes. Fonts are Arial / Times New
 * Roman, which are metric-compatible with the PDF fonts, so lines wrap alike.
 */

const esc = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Strip characters that are invalid in XML 1.0 (matching control characters is the point here).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "");

const NS = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"`;
const hex = (color?: string) => (color ?? "#000000").replace("#", "").toUpperCase();
const twips = (pt: number) => Math.round(pt * 20);

function runXml(r: Run, para: Para) {
  if (!r.text) return "";
  const props = `${r.style.includes("bold") ? "<w:b/>" : ""}${r.style.includes("italic") ? "<w:i/>" : ""}<w:color w:val="${hex(para.color)}"/><w:sz w:val="${Math.round(para.size * 2)}"/><w:szCs w:val="${Math.round(para.size * 2)}"/>`;
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
}

export function buildDocumentXml(resume: Resume, settings: DocumentSettings): string {
  const s = effectiveSettings(settings);
  const paper = PAPER_PT[s.paper];
  const margin = twips(s.margin * 72);
  const contentWidth = twips(paper.w - s.margin * 144);
  const replaced = new Set<string>();
  const body = buildParas(resume, s).map((para) => {
    const clean = (runs: Run[]) => runs.map((r) => ({ ...r, text: sanitizeText(r.text, replaced) }));
    const p = { ...para, runs: clean(para.runs), right: para.right ? clean(para.right) : undefined };
    const style = p.kind === "name" ? `<w:pStyle w:val="Title"/>` : p.kind === "heading" ? `<w:pStyle w:val="Heading1"/>` : p.kind === "bullet" ? `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>` : "";
    const keep = p.keepNext ? "<w:keepNext/>" : "";
    const border = p.rule ? `<w:pBdr><w:bottom w:val="single" w:sz="${Math.max(2, Math.round(p.rule.width * 8))}" w:space="${Math.max(1, Math.round(p.rule.gap))}" w:color="${hex(p.rule.color)}"/></w:pBdr>` : "";
    const tabs = p.right ? `<w:tabs><w:tab w:val="right" w:pos="${contentWidth}"/></w:tabs>` : "";
    const spacing = `<w:spacing w:before="${twips(p.before)}" w:after="${twips(p.after)}" w:line="${twips(p.size * p.lineFactor)}" w:lineRule="exact"/>`;
    const ind = p.kind === "bullet" ? `<w:ind w:left="${twips(p.indent)}" w:hanging="${twips(p.indent - (p.glyph?.x ?? 0))}"/>` : "";
    const jc = p.align === "center" ? `<w:jc w:val="center"/>` : "";
    const runs = p.runs.map((r) => runXml(r, p)).join("");
    const right = p.right ? `<w:r><w:tab/></w:r>${p.right.map((r) => runXml(r, p)).join("")}` : "";
    return `<w:p><w:pPr>${style}${keep}${border}${tabs}${spacing}${ind}${jc}</w:pPr>${runs}${right}</w:p>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="${twips(paper.w)}" w:h="${twips(paper.h)}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function stylesXml(settings: DocumentSettings) {
  const s = effectiveSettings(settings);
  const font = DOCX_FAMILY[FONT_FAMILY[s.font]];
  const size = Math.round(s.fontSize * 2);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${twips(s.fontSize * s.lineSpacing)}" w:lineRule="exact"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;
}

function numberingXml(settings: DocumentSettings) {
  const s = effectiveSettings(settings);
  const left = twips(s.bulletIndent);
  const hanging = twips(Math.min(s.bulletIndent - Math.max(3, s.bulletIndent - 10), s.bulletIndent));
  const font = DOCX_FAMILY[FONT_FAMILY[s.font]];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${left}" w:hanging="${hanging}"/></w:pPr><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
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
