import { effectiveOrder } from "../model/defaults";
import { SECTION_LABELS, type DocumentSettings, type Resume, type SectionKey } from "../model/types";
import { defaultMeasurer, type Measurer } from "./measurer";
import { effectiveSettings, FONT_BOX, FONT_FAMILY, LIMITS, TEMPLATE_SPECS } from "./templates";
import type { FitReport, LayoutPage, LayoutResult, Para, PdfFamily, PlacedLine, PlacedRule, PlacedRun, Run, Style } from "./types";

export const PAPER_PT = { letter: { w: 612, h: 792 }, a4: { w: 595.28, h: 841.89 } } as const;

const CP1252_EXTRAS = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Replace characters the standard PDF fonts cannot encode; the caller reports what was replaced. */
export function sanitizeText(text: string, replaced: Set<string>): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    const code = char.codePointAt(0) ?? 0;
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || CP1252_EXTRAS.includes(char)) out += char;
    else if (char === "\t" || char === "\n" || char === "\r") out += " ";
    else if (char === "‐" || char === "‑" || char === "−") out += "-";
    else if (char === "→") out += "->";
    else if (char === "●" || char === "▪" || char === "◦") out += "•";
    else {
      replaced.add(char);
      out += "?";
    }
  }
  return out;
}

export function sectionLabel(key: SectionKey, resume: Resume): string {
  if (key.startsWith("custom:")) return resume.custom.find((section) => `custom:${section.id}` === key)?.title || "Section";
  return SECTION_LABELS[key as keyof typeof SECTION_LABELS];
}

const dateRange = (start: string, end: string) => [start, end].filter(Boolean).join(" – ");
const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const run = (text: string, style: Style = "normal"): Run => ({ text, style });

/** Resume → semantic paragraphs for the chosen template. Nothing is dropped here. */
export function buildParas(resume: Resume, settings: DocumentSettings): Para[] {
  const s = effectiveSettings(settings);
  const tpl = TEMPLATE_SPECS[s.template];
  const body = s.fontSize;
  const paras: Para[] = [];
  const align = s.headerLayout;
  const hidden = new Set(s.hiddenSections ?? []);
  const base = { align: "left" as const, indent: 0, before: 0, after: 0, lineFactor: s.lineSpacing };
  const { contact } = resume;

  if (contact.name.trim()) {
    paras.push({ ...base, key: "name", section: "header", kind: "name", runs: [run(clean(contact.name), "bold")], size: Math.round(body * tpl.nameScale * 2) / 2, align, color: tpl.nameColor, after: 0.5, lineFactor: 1.15 });
  }
  if (contact.headline.trim()) {
    paras.push({ ...base, key: "headline", section: "header", kind: "headline", runs: [run(clean(contact.headline), tpl.headlineStyle)], size: body + 0.5, align, after: 0.5 });
  }
  const contactItems = [contact.location, contact.phone, contact.email, contact.linkedin, contact.github, contact.website, ...contact.other].map(clean).filter(Boolean);
  if (contactItems.length) {
    paras.push({ ...base, key: "contact", section: "header", kind: "contact", runs: [run(contactItems.join(" | "))], size: body - 0.5, align });
  }

  const heading = (key: SectionKey) => {
    const label = sectionLabel(key, resume);
    paras.push({
      ...base,
      key: `h-${key}`,
      section: key,
      kind: "heading",
      runs: [run(tpl.headingUpper ? label.toUpperCase() : label, "bold")],
      size: Math.min(11, body + (tpl.headingUpper ? 0 : 0.5)),
      before: paras.length ? s.sectionSpacing : 0,
      after: 2,
      keepNext: true,
      color: tpl.headingColor,
      rule: { color: tpl.ruleColor, width: tpl.ruleWidth, gap: 1 },
    });
  };
  const bullets = (group: string, section: SectionKey, items: string[]) =>
    items
      .map(clean)
      .filter(Boolean)
      .forEach((item, index) =>
        paras.push({ ...base, key: `${group}-b${index}`, section, kind: "bullet", runs: [run(item)], size: body, indent: s.bulletIndent, glyph: { text: "•", x: Math.max(3, s.bulletIndent - 10) }, after: 0 }),
      );
  const paragraph = (key: string, section: SectionKey, text: string, kind: Para["kind"] = "paragraph") => paras.push({ ...base, key, section, kind, runs: [run(clean(text))], size: body, after: 0.5 });

  for (const key of effectiveOrder(resume, s)) {
    if (hidden.has(key)) continue;
    switch (key) {
      case "summary":
        if (!resume.summary.trim()) break;
        heading(key);
        paragraph("summary", key, resume.summary, "summary");
        break;
      case "skills": {
        const categories = resume.skills.filter((category) => category.skills.some((skill) => skill.trim()));
        if (!categories.length) break;
        heading(key);
        for (const category of categories) {
          const items = category.skills.map(clean).filter(Boolean);
          const separator = s.template === "classic" || items.some((item) => item.includes(",")) ? "; " : ", ";
          paras.push({
            ...base,
            key: `skills-${category.id}`,
            section: key,
            kind: "skill",
            runs: [...(category.name.trim() ? [run(`${clean(category.name)}: `, "bold")] : []), run(items.join(separator))],
            size: body + tpl.skillsDelta,
            after: 0,
          });
        }
        break;
      }
      case "experience": {
        if (!resume.experience.length) break;
        heading(key);
        resume.experience.forEach((entry, index) => {
          const dates = dateRange(entry.startDate, entry.current ? "Present" : entry.endDate);
          const place = clean(entry.location);
          const bulletsOf = entry.bullets.some((bullet) => bullet.trim());
          const common = { ...base, section: key, size: body, keepNext: true, before: index ? 2 : 0 };
          if (tpl.entryLead === "employer" && entry.employer.trim()) {
            const empPlace = place ? `${clean(entry.employer)} — ${place}` : clean(entry.employer);
            paras.push({
              ...common,
              key: `exp-${entry.id}`,
              kind: "entry",
              runs: [run(empPlace, "bold")],
              right: dates ? [run(dates, "bolditalic")] : undefined,
            });
            if (entry.title.trim()) paras.push({ ...common, key: `exp-${entry.id}-t`, kind: "entrysub", before: 0, keepNext: bulletsOf, runs: [run(clean(entry.title), "bold")] });
            else paras[paras.length - 1].keepNext = bulletsOf;
          } else {
            const lead = clean(entry.title) || clean(entry.employer);
            paras.push({ ...common, key: `exp-${entry.id}`, kind: "entry", runs: [run(lead, "bold")], right: dates ? [run(dates)] : undefined });
            const sub = [entry.title.trim() ? clean(entry.employer) : "", place].filter(Boolean).join(" — ");
            if (sub) paras.push({ ...common, key: `exp-${entry.id}-t`, kind: "entrysub", before: 0, keepNext: bulletsOf, runs: [run(sub, "italic")] });
            else paras[paras.length - 1].keepNext = bulletsOf;
          }
          bullets(`exp-${entry.id}`, key, entry.bullets);
        });
        break;
      }
      case "projects": {
        if (!resume.projects.length) break;
        heading(key);
        resume.projects.forEach((entry, index) => {
          const tech = entry.technologies.map(clean).filter(Boolean).join(", ");
          const dates = dateRange(entry.startDate, entry.endDate);
          const hasBody = Boolean(entry.description.trim()) || entry.bullets.some((bullet) => bullet.trim());
          const projHead = [
            entry.role.trim() ? `${clean(entry.name)} — ${clean(entry.role)}` : clean(entry.name),
            tech,
          ]
            .filter(Boolean)
            .join(" | ");
          paras.push({
            ...base,
            key: `proj-${entry.id}`,
            section: key,
            kind: "entry",
            size: body,
            before: index ? 2 : 0,
            keepNext: hasBody,
            runs: [run(projHead, "bold")],
            right: dates ? [run(dates)] : undefined,
          });
          const links = [entry.githubUrl, entry.liveUrl].map(clean).filter(Boolean).join(" | ");
          if (links) paras.push({ ...base, key: `proj-${entry.id}-l`, section: key, kind: "entrysub", size: body, keepNext: hasBody, runs: [run(links, "italic")] });
          if (entry.description.trim()) paragraph(`proj-${entry.id}-d`, key, entry.description);
          bullets(`proj-${entry.id}`, key, entry.bullets);
        });
        break;
      }
      case "education": {
        if (!resume.education.length) break;
        heading(key);
        resume.education.forEach((entry, index) => {
          const degree = [entry.degree, entry.field].map(clean).filter(Boolean).join(", ");
          const dates = dateRange(entry.startDate, entry.endDate);
          const place = clean(entry.location);
          const lead = clean(entry.institution) || degree;
          const inlineDates = s.template === "classic";
          const rest = [
            entry.institution.trim() ? degree : "",
            entry.gpa.trim() ? `GPA ${clean(entry.gpa)}` : "",
            inlineDates ? dates : "",
          ]
            .filter(Boolean)
            .join(" | ");
          const hasDetails = entry.details.some((detail) => detail.trim());
          const eduLead = place ? `${lead} — ${place}` : lead;
          paras.push({
            ...base,
            key: `edu-${entry.id}`,
            section: key,
            kind: "entry",
            size: body,
            before: index ? 1.5 : 0,
            keepNext: hasDetails,
            runs: [run(eduLead, "bold"), ...(rest ? [run(` | ${rest}`)] : [])],
            right: !inlineDates && dates ? [run(dates)] : undefined,
          });
          bullets(`edu-${entry.id}`, key, entry.details);
        });
        break;
      }
      case "certifications": {
        if (!resume.certifications.length) break;
        heading(key);
        const text = (cert: Resume["certifications"][number]) => {
          const extra = [cert.issuer, cert.date, cert.credentialId && `ID ${cert.credentialId}`].map((part) => clean(part ?? "")).filter(Boolean);
          return { name: clean(cert.name), extra };
        };
        if (tpl.certLayout === "inline") {
          // One compact wrapped paragraph, as in the reference résumé.
          const runs: Run[] = [];
          resume.certifications.forEach((cert, index) => {
            const { name, extra } = text(cert);
            if (index) runs.push(run(" | "));
            runs.push(run(name, extra.length ? "bold" : "normal"));
            if (extra.length) runs.push(run(` (${extra.join(", ")})`));
          });
          paras.push({ ...base, key: "certs", section: key, kind: "cert", runs, size: body, after: 0 });
        } else {
          for (const cert of resume.certifications) {
            const { name, extra } = text(cert);
            paras.push({ ...base, key: `cert-${cert.id}`, section: key, kind: "cert", size: body, runs: [run(name, "bold"), ...(cert.issuer.trim() ? [run(`, ${clean(cert.issuer)}`)] : [])], right: cert.date ? [run(clean(cert.date))] : undefined, after: extra.length ? 0 : 0 });
          }
        }
        break;
      }
      case "awards":
      case "publications": {
        const items = resume[key].map((item) => item.text);
        if (!items.some((item) => item.trim())) break;
        heading(key);
        bullets(key, key, items);
        break;
      }
      default: {
        const section = resume.custom.find((custom) => `custom:${custom.id}` === key);
        if (!section || !section.items.some((item) => item.text.trim())) break;
        heading(key);
        bullets(key, key, section.items.map((item) => item.text));
      }
    }
  }
  return paras;
}

type Atom = { text: string; style: Style };

/** Split styled runs into unbreakable chunks (word groups separated by spaces). */
function chunksOf(runs: Run[]): Atom[][] {
  const chunks: Atom[][] = [];
  let current: Atom[] = [];
  for (const r of runs) {
    const parts = r.text.split(/( +)/);
    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith(" ")) {
        if (current.length) chunks.push(current);
        current = [];
      } else current.push({ text: part, style: r.style });
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

type WrappedLine = { atoms: Atom[]; width: number };

function wrapRuns(runs: Run[], size: number, family: PdfFamily, m: Measurer, firstWidth: number, restWidth: number): WrappedLine[] {
  const chunks = chunksOf(runs);
  const widthOf = (atoms: Atom[]) => atoms.reduce((sum, atom) => sum + m(atom.text, family, atom.style, size), 0);
  const spaceW = (style: Style) => m(" ", family, style, size);
  const lines: WrappedLine[] = [];
  let atoms: Atom[] = [];
  let width = 0;
  const limit = () => (lines.length === 0 ? firstWidth : restWidth);
  const push = () => {
    if (atoms.length) lines.push({ atoms, width });
    atoms = [];
    width = 0;
  };
  for (const chunk of chunks) {
    let pieces: Atom[][] = [chunk];
    // Break a single over-long chunk (long URL) by characters.
    if (widthOf(chunk) > restWidth) {
      pieces = [];
      let part: Atom[] = [];
      let partWidth = 0;
      for (const atom of chunk)
        for (const char of atom.text) {
          const w = m(char, family, atom.style, size);
          if (partWidth + w > restWidth && part.length) {
            pieces.push(part);
            part = [];
            partWidth = 0;
          }
          const last = part[part.length - 1];
          if (last && last.style === atom.style) last.text += char;
          else part.push({ text: char, style: atom.style });
          partWidth += w;
        }
      if (part.length) pieces.push(part);
    }
    pieces.forEach((piece, pieceIndex) => {
      const pieceWidth = widthOf(piece);
      const gap = atoms.length && pieceIndex === 0 ? spaceW(atoms[atoms.length - 1].style) : 0;
      if (atoms.length && width + gap + pieceWidth > limit() + 0.01) push();
      if (atoms.length) {
        const prev = atoms[atoms.length - 1];
        const addGap = pieceIndex === 0 ? gap : 0;
        if (addGap) {
          prev.text += " ";
          width += addGap;
        }
      }
      for (const atom of piece) {
        const last = atoms[atoms.length - 1];
        if (last && last.style === atom.style) last.text += atom.text;
        else atoms.push({ ...atom });
      }
      width += pieceWidth;
      if (pieceIndex < pieces.length - 1) push();
    });
  }
  push();
  return lines.length ? lines : [{ atoms: [], width: 0 }];
}

type FlowItem = { para: Para; lines: PlacedLine[]; rule?: PlacedRule; height: number; top: number };

export function layoutResume(resume: Resume, settings: DocumentSettings, measure: Measurer = defaultMeasurer): LayoutResult {
  const s = effectiveSettings(settings);
  const family = FONT_FAMILY[s.font];
  const paper = PAPER_PT[s.paper];
  const marginPt = s.margin * 72;
  const contentW = paper.w - marginPt * 2;
  const limit = paper.h - marginPt;
  const replaced = new Set<string>();
  const paras = buildParas(resume, s).map((para) => ({
    ...para,
    runs: para.runs.map((r) => ({ ...r, text: sanitizeText(r.text, replaced) })),
    right: para.right?.map((r) => ({ ...r, text: sanitizeText(r.text, replaced) })),
  }));

  const box = FONT_BOX[family];
  const items: FlowItem[] = [];
  for (const para of paras) {
    const pitch = para.size * para.lineFactor;
    const rightWidth = para.right ? para.right.reduce((sum, r) => sum + measure(r.text, family, r.style, para.size), 0) : 0;
    const left = marginPt + para.indent;
    const available = contentW - para.indent;
    const first = para.right ? available - rightWidth - 10 : available;
    const wrapped = wrapRuns(para.runs, para.size, family, measure, Math.max(first, 40), available);
    const lines: PlacedLine[] = wrapped.map((line, index) => {
      const centered = para.align === "center";
      const x0 = centered ? marginPt + (contentW - line.width) / 2 : left;
      let x = x0;
      const runs: PlacedRun[] = line.atoms.map((atom) => {
        const width = measure(atom.text, family, atom.style, para.size);
        const placed = { text: atom.text, style: atom.style, x, width };
        x += width;
        return placed;
      });
      if (index === 0 && para.right) {
        let rx = marginPt + contentW - rightWidth;
        for (const r of para.right) {
          const width = measure(r.text, family, r.style, para.size);
          runs.push({ text: r.text, style: r.style, x: rx, width });
          rx += width;
        }
      }
      return {
        key: `${para.key}:${index}`,
        paraKind: para.kind,
        section: para.section,
        runs,
        y: 0,
        height: pitch,
        baseline: (pitch - (box.ascent + box.descent) * para.size) / 2 + box.ascent * para.size,
        size: para.size,
        color: para.color,
        glyph: index === 0 && para.glyph ? { text: para.glyph.text, x: marginPt + para.glyph.x } : undefined,
      };
    });
    const height = lines.length * pitch + (para.rule ? para.rule.gap + para.rule.width : 0);
    items.push({ para, lines, height, top: 0 });
  }

  // Continuous flow first: gives total height and overflow independent of pagination.
  let cursor = marginPt;
  items.forEach((item, index) => {
    // Space before a paragraph collapses at the top of the page after a break, handled in pagination.
    cursor += item.para.before;
    item.top = cursor;
    cursor += item.height + item.para.after;
    void index;
  });
  const flowBottom = cursor - (items.length ? items[items.length - 1].para.after : 0);

  // Paginate whole paragraphs, carrying "keep with next" chains to the next page.
  const pageList: FlowItem[][] = [[]];
  let y = marginPt;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const page = pageList[pageList.length - 1];
    const before = page.length ? item.para.before : 0;
    if (y + before + item.height > limit + 0.01 && page.length) {
      const carried: FlowItem[] = [];
      while (page.length > 1 && page[page.length - 1].para.keepNext) carried.unshift(page.pop()!);
      pageList.push(carried);
      y = marginPt;
      for (const c of carried) y += (y === marginPt ? 0 : c.para.before) + c.height + c.para.after;
    }
    const target = pageList[pageList.length - 1];
    y += target.length ? item.para.before : 0;
    target.push(item);
    y += item.height + item.para.after;
  }

  const pages: LayoutPage[] = pageList.map((page) => {
    let top = marginPt;
    const lines: PlacedLine[] = [];
    const rules: PlacedRule[] = [];
    page.forEach((item, index) => {
      top += index ? item.para.before : 0;
      item.lines.forEach((line, lineIndex) => lines.push({ ...line, y: top + lineIndex * (item.para.size * item.para.lineFactor) }));
      if (item.para.rule) {
        const ry = top + item.lines.length * item.para.size * item.para.lineFactor + item.para.rule.gap;
        rules.push({ y: ry, x1: marginPt, x2: marginPt + contentW, width: item.para.rule.width, color: item.para.rule.color });
      }
      top += item.height + item.para.after;
    });
    return { lines, rules };
  });

  const bodyPitch = s.fontSize * s.lineSpacing;
  const overflowPt = Math.max(0, flowBottom - limit);
  const overflowLines = overflowPt > 0.5 ? Math.ceil(overflowPt / bodyPitch - 0.001) : 0;
  const availablePt = limit - marginPt;
  const used = Math.min(flowBottom, limit) - marginPt;
  const totalLines = pages.reduce((sum, page) => sum + page.lines.length, 0);
  const fit: FitReport = {
    pageCount: pages.length,
    fitsOnePage: pages.length === 1 && overflowLines === 0,
    totalLines,
    overflowLines,
    overflowPt,
    usedPt: flowBottom - marginPt,
    availablePt,
    fillRatio: Math.max(0, used) / availablePt,
    label: pages.length === 1 && overflowLines === 0 ? "Page Fit: 1 of 1" : `Over limit: ${overflowLines || 1} line${overflowLines === 1 ? "" : "s"}`,
  };
  if (!fit.fitsOnePage && pages.length > 1) fit.label = `Over limit: ${overflowLines} line${overflowLines === 1 ? "" : "s"} (${pages.length} pages)`;

  const issues: LayoutResult["readability"]["issues"] = [];
  if (settings.fontSize < LIMITS.fontMin) issues.push({ id: "font", message: `Body text was raised from ${settings.fontSize} pt to the ${LIMITS.fontMin} pt readable minimum.` });
  if (settings.margin < LIMITS.marginMin) issues.push({ id: "margin", message: `Margins were raised to ${LIMITS.marginMin} in.` });
  if (replaced.size) issues.push({ id: "chars", message: `${replaced.size} character(s) the standard fonts cannot show were replaced with “?”: ${[...replaced].slice(0, 8).join(" ")}` });

  return { pages, paras, fit, readability: { ok: issues.length === 0, issues }, page: { widthPt: paper.w, heightPt: paper.h, marginPt }, family, replacedChars: [...replaced] };
}
