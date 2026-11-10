import type { ReactNode } from "react";
import { SECTION_LABELS, type DocumentSettings, type Resume, type SectionKey } from "../model/types";
import { effectiveOrder } from "../model/defaults";

/**
 * A résumé flattened into measurable blocks. Pagination moves whole blocks
 * between pages; headings and entry titles are kept with what follows them.
 */
export type DocBlock = {
  key: string;
  kind: "header" | "heading" | "paragraph" | "entry" | "bullet" | "line";
  /** Bullets sharing a group render inside one list on each page. */
  group?: string;
  keepWithNext?: boolean;
  node: ReactNode;
};

const dateRange = (start: string, end: string) => [start, end].filter(Boolean).join(" – ");
const joinParts = (...parts: Array<string | undefined>) => parts.filter((part) => part && part.trim()).join(" · ");

function EntryHead({ title, subtitle, dates, meta }: { title: string; subtitle?: string; dates?: string; meta?: string }) {
  return (
    <div className="rd-entry-head">
      <div className="rd-entry-line">
        <span className="rd-entry-title">{title}</span>
        {dates ? <span className="rd-entry-dates">{dates}</span> : null}
      </div>
      {subtitle || meta ? (
        <div className="rd-entry-line rd-entry-sub">
          <span>{subtitle}</span>
          {meta ? <span className="rd-entry-meta">{meta}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function sectionTitle(key: SectionKey, resume: Resume) {
  if (key.startsWith("custom:")) return resume.custom.find((section) => `custom:${section.id}` === key)?.title || "Section";
  return SECTION_LABELS[key as keyof typeof SECTION_LABELS];
}

export function buildBlocks(resume: Resume, settings: DocumentSettings): DocBlock[] {
  const blocks: DocBlock[] = [];
  const { contact } = resume;
  const contactLine = [contact.location, contact.phone, contact.email].filter(Boolean);
  const linkLine = [contact.linkedin, contact.github, contact.website, ...contact.other].filter(Boolean);
  if (contact.name || contactLine.length || linkLine.length || contact.headline) {
    blocks.push({
      key: "header",
      kind: "header",
      node: (
        <header className="rd-header">
          {contact.name ? <h1 className="rd-name">{contact.name}</h1> : null}
          {contact.headline ? <p className="rd-headline">{contact.headline}</p> : null}
          {contactLine.length ? <p className="rd-contact">{contactLine.join("  |  ")}</p> : null}
          {linkLine.length ? <p className="rd-contact">{linkLine.join("  |  ")}</p> : null}
        </header>
      ),
    });
  }

  const heading = (key: SectionKey) =>
    blocks.push({ key: `h-${key}`, kind: "heading", keepWithNext: true, node: <h2 className="rd-heading">{sectionTitle(key, resume)}</h2> });
  const bullets = (group: string, items: string[]) =>
    items.filter((item) => item.trim()).forEach((item, index) => blocks.push({ key: `${group}-b${index}`, kind: "bullet", group, node: item }));

  for (const key of effectiveOrder(resume, settings)) {
    switch (key) {
      case "summary":
        if (!resume.summary.trim()) break;
        heading(key);
        blocks.push({ key: "summary", kind: "paragraph", node: <p className="rd-paragraph">{resume.summary}</p> });
        break;
      case "skills": {
        const categories = resume.skills.filter((category) => category.skills.length);
        if (!categories.length) break;
        heading(key);
        categories.forEach((category) =>
          blocks.push({
            key: `skills-${category.id}`,
            kind: "line",
            node: (
              <p className="rd-skill-line">
                {category.name ? <strong>{category.name}: </strong> : null}
                {category.skills.join(", ")}
              </p>
            ),
          }),
        );
        break;
      }
      case "experience":
        if (!resume.experience.length) break;
        heading(key);
        resume.experience.forEach((entry) => {
          blocks.push({
            key: `exp-${entry.id}`,
            kind: "entry",
            keepWithNext: entry.bullets.length > 0,
            node: <EntryHead title={entry.title || entry.employer} subtitle={entry.title ? entry.employer : ""} dates={dateRange(entry.startDate, entry.current ? "Present" : entry.endDate)} meta={entry.location} />,
          });
          bullets(`exp-${entry.id}`, entry.bullets);
        });
        break;
      case "projects":
        if (!resume.projects.length) break;
        heading(key);
        resume.projects.forEach((entry) => {
          const links = [entry.githubUrl, entry.liveUrl].filter(Boolean).join("  |  ");
          blocks.push({
            key: `proj-${entry.id}`,
            kind: "entry",
            keepWithNext: Boolean(entry.description || entry.bullets.length),
            node: (
              <EntryHead
                title={entry.name}
                dates={dateRange(entry.startDate, entry.endDate)}
                subtitle={joinParts(entry.role, entry.technologies.length ? entry.technologies.join(", ") : "")}
                meta={links}
              />
            ),
          });
          if (entry.description.trim()) blocks.push({ key: `proj-${entry.id}-d`, kind: "paragraph", node: <p className="rd-paragraph">{entry.description}</p> });
          bullets(`proj-${entry.id}`, entry.bullets);
        });
        break;
      case "education":
        if (!resume.education.length) break;
        heading(key);
        resume.education.forEach((entry) => {
          const degree = [entry.degree, entry.field].filter(Boolean).join(", ");
          blocks.push({
            key: `edu-${entry.id}`,
            kind: "entry",
            keepWithNext: entry.details.length > 0,
            node: <EntryHead title={entry.institution || degree} subtitle={joinParts(entry.institution ? degree : "", entry.gpa && `GPA ${entry.gpa}`)} dates={dateRange(entry.startDate, entry.endDate)} meta={entry.location} />,
          });
          bullets(`edu-${entry.id}`, entry.details);
        });
        break;
      case "certifications":
        if (!resume.certifications.length) break;
        heading(key);
        resume.certifications.forEach((cert) =>
          blocks.push({
            key: `cert-${cert.id}`,
            kind: "line",
            node: (
              <div className="rd-entry-line rd-simple-line">
                <span>
                  <strong>{cert.name}</strong>
                  {cert.issuer ? `, ${cert.issuer}` : ""}
                  {cert.credentialId ? ` (Credential ID ${cert.credentialId})` : ""}
                </span>
                {cert.date ? <span className="rd-entry-dates">{cert.date}</span> : null}
              </div>
            ),
          }),
        );
        break;
      case "awards":
      case "publications": {
        const items = resume[key].map((item) => item.text);
        if (!items.some((item) => item.trim())) break;
        heading(key);
        bullets(key, items);
        break;
      }
      default: {
        const section = resume.custom.find((custom) => `custom:${custom.id}` === key);
        if (!section || !section.items.some((item) => item.text.trim())) break;
        heading(key);
        bullets(key, section.items.map((item) => item.text));
      }
    }
  }
  return blocks;
}

/** Render a run of blocks, grouping consecutive bullets of one entry into a real list. */
export function renderBlocks(blocks: DocBlock[], indexOf: (block: DocBlock) => number) {
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.kind === "bullet") {
      const items: DocBlock[] = [];
      while (i < blocks.length && blocks[i].kind === "bullet" && blocks[i].group === block.group) items.push(blocks[i++]);
      i--;
      out.push(
        // The bullet glyph is real text (not a CSS marker) so it survives PDF text extraction.
        <ul className="rd-bullets" role="list" key={`${block.key}-list`}>
          {items.map((item) => (
            <li key={item.key} data-block={indexOf(item)}>
              <span className="rd-glyph" aria-hidden="true">•</span>
              <span className="rd-bullet-text">{item.node}</span>
            </li>
          ))}
        </ul>,
      );
    } else
      out.push(
        <div key={block.key} data-block={indexOf(block)} className={`rd-block rd-block-${block.kind}`}>
          {block.node}
        </div>,
      );
  }
  return out;
}
