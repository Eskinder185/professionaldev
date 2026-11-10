import { emptyResume, uid } from "../model/defaults";
import type {
  CertificationEntry,
  ContactInfo,
  EducationEntry,
  ExperienceEntry,
  ParseIssue,
  ProjectEntry,
  Resume,
  SectionKey,
  SimpleItem,
  SkillCategory,
} from "../model/types";
import {
  DEGREE_RE,
  EMAIL_RE,
  GPA_RE,
  INSTITUTION_RE,
  LOCATION_RE,
  LOCATION_TAIL_RE,
  ORG_RE,
  PHONE_RE,
  ROLE_RE,
  URL_RE,
  findDates,
  isBullet,
  isTerminated,
  normalizeUrl,
  splitList,
  splitSegments,
  startsLowercase,
  stripBullet,
  wordCount,
} from "./patterns";

/**
 * Pipeline: normalize text → identify sections → parse entries → normalize
 * structure → collect review issues. Nothing is dropped: anything that cannot
 * be placed confidently ends up in a visible field plus a review issue.
 */

type StandardKind = Exclude<SectionKey, `custom:${string}`>;
type RawSection = { kind: StandardKind | "custom"; title: string; lines: string[]; headingLine: string };

export type ParseResult = { resume: Resume; issues: ParseIssue[] };

const HEADINGS: Record<StandardKind | "custom", string[]> = {
  summary: ["summary", "professional summary", "profile", "professional profile", "objective", "career objective", "about", "about me", "career summary", "executive summary", "overview", "summary of qualifications", "qualifications summary", "personal statement"],
  skills: ["skills", "technical skills", "core competencies", "competencies", "technologies", "technical proficiencies", "skills and tools", "tools and technologies", "skills and abilities", "key skills", "areas of expertise", "expertise", "technical expertise", "skill set", "skillset", "core skills", "skills and technologies", "technical skills and tools"],
  experience: ["experience", "work experience", "professional experience", "employment", "employment history", "work history", "relevant experience", "career history", "professional background", "internship experience", "internships", "experience and internships", "technical experience"],
  projects: ["projects", "personal projects", "technical projects", "selected projects", "academic projects", "key projects", "project experience", "notable projects", "side projects", "portfolio", "relevant projects"],
  education: ["education", "academic background", "education and training", "academics", "educational background", "education and certifications"],
  certifications: ["certifications", "certification", "certificates", "licenses and certifications", "certifications and licenses", "licenses", "professional certifications", "credentials", "certifications and training"],
  awards: ["awards", "honors", "awards and honors", "honors and awards", "achievements", "recognition", "awards and recognition"],
  publications: ["publications", "papers", "research publications", "publications and presentations"],
  custom: ["volunteer experience", "volunteering", "volunteer", "leadership", "leadership experience", "activities", "extracurricular activities", "languages", "interests", "references", "relevant coursework", "coursework", "research", "research experience", "involvement", "affiliations", "professional affiliations", "training", "memberships", "additional information", "community involvement", "professional development"],
};

const HEADING_LOOKUP = new Map<string, StandardKind | "custom">();
for (const [kind, names] of Object.entries(HEADINGS)) for (const name of names) HEADING_LOOKUP.set(name, kind as StandardKind | "custom");

const normalizeHeading = (line: string) =>
  line
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function headingKind(line: string): StandardKind | "custom" | null {
  const trimmed = line.trim().replace(/[:\s]+$/, "");
  if (!trimmed || trimmed.length > 45 || wordCount(trimmed) > 5 || isBullet(line)) return null;
  return HEADING_LOOKUP.get(normalizeHeading(trimmed)) ?? null;
}

const titleCase = (text: string) => text.toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase());

/** Clean extraction artefacts and split inline bullets in collapsed text. */
export function normalizeLines(text: string): { lines: string[]; collapsed: boolean } {
  const cleaned = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\uf0b7|\uf0a7|\uf076|\uf0d8/g, "•");
  let lines = cleaned.split("\n").map((line) => line.replace(/[ ]+$/g, ""));
  const nonEmpty = lines.filter((line) => line.trim());
  const average = nonEmpty.reduce((sum, line) => sum + line.length, 0) / Math.max(1, nonEmpty.length);
  const collapsed = cleaned.length > 400 && (nonEmpty.length < 6 || average > 180);
  if (collapsed) {
    // Text lost its line breaks: recover bullets and known headings where they are unambiguous.
    const headingWords = [...HEADING_LOOKUP.keys()].filter((name) => name.split(" ").length <= 3).sort((a, b) => b.length - a.length);
    const headingRe = new RegExp(`\\s(${headingWords.map((word) => word.toUpperCase().replace(/ /g, "\\s+")).join("|")})(?::|\\s)\\s*`, "g");
    lines = lines.flatMap((line) =>
      line
        .replace(headingRe, "\n$1\n")
        .replace(/\s+([•●▪◦])\s+/g, "\n$1 ")
        .split("\n"),
    );
  }
  return { lines: lines.map((line) => line.replace(/\s+$/, "")), collapsed };
}

function splitSections(lines: string[]) {
  const header: string[] = [];
  const sections: RawSection[] = [];
  let firstContent = true;
  for (const line of lines) {
    const kind = firstContent && line.trim() ? null : headingKind(line);
    if (line.trim()) firstContent = false;
    if (kind) {
      const title = line.trim().replace(/[:\s]+$/, "");
      sections.push({ kind, title: kind === "custom" ? titleCase(title) : title, lines: [], headingLine: line.trim() });
    } else if (sections.length) sections[sections.length - 1].lines.push(line);
    else header.push(line);
  }
  return { header, sections };
}

/** Group lines into items: bullets with wrapped continuation lines joined. */
export function toItems(lines: string[]): string[] {
  const items: string[] = [];
  let blankBefore = true;
  let lastWasBullet = false;
  for (const raw of lines) {
    if (!raw.trim()) {
      blankBefore = true;
      continue;
    }
    const bullet = isBullet(raw);
    const text = bullet ? stripBullet(raw) : raw.trim();
    const previous = items[items.length - 1];
    const continuation =
      !bullet &&
      !blankBefore &&
      previous !== undefined &&
      (startsLowercase(text) || (lastWasBullet && !isTerminated(previous) && !findDates(text)));
    if (continuation) items[items.length - 1] = `${previous} ${text}`;
    else {
      items.push(text);
      lastWasBullet = bullet;
    }
    blankBefore = false;
  }
  return items;
}

const simpleItems = (lines: string[]): SimpleItem[] => toItems(lines).map((text) => ({ id: uid(), text }));

function parseContact(header: string[], issues: ParseIssue[]) {
  const contact: ContactInfo = { name: "", headline: "", email: "", phone: "", location: "", linkedin: "", github: "", website: "", other: [] };
  const leftovers: string[] = [];
  const lines = header.filter((line) => line.trim());
  lines.forEach((line, lineIndex) => {
    const segments = splitSegments(line).flatMap((segment) => (segment.includes(",") && /@|https?:|\d{3}/.test(segment) && !LOCATION_RE.test(segment) ? segment.split(/\s*,\s*/) : [segment]));
    segments.forEach((segment, segmentIndex) => {
      let rest = segment;
      const email = rest.match(EMAIL_RE);
      if (email) {
        if (!contact.email) contact.email = email[0];
        else contact.other.push(email[0]);
        rest = rest.replace(email[0], " ");
      }
      const phone = rest.match(PHONE_RE);
      if (phone) {
        if (!contact.phone) contact.phone = phone[0].trim();
        else contact.other.push(phone[0].trim());
        rest = rest.replace(phone[0], " ");
      }
      let url = rest.match(URL_RE);
      while (url) {
        const value = normalizeUrl(url[0]);
        if (/linkedin\.com/i.test(value) && !contact.linkedin) contact.linkedin = value;
        else if (/github\.com/i.test(value) && !contact.github) contact.github = value;
        else if (!contact.website && !/linkedin|github/i.test(value)) contact.website = value;
        else contact.other.push(value);
        rest = rest.replace(url[0], " ");
        url = rest.match(URL_RE);
      }
      rest = rest.replace(/^(?:email|e-mail|phone|tel|mobile|cell|linkedin|github|portfolio|website)\s*[:-]\s*/i, "").replace(/^[\s,|:·•-]+|[\s,|:·•-]+$/g, "").trim();
      if (!rest) return;
      if (!contact.location && LOCATION_RE.test(rest)) contact.location = rest;
      else if (!contact.name && lineIndex === 0 && segmentIndex === 0 && wordCount(rest) <= 5 && !/\d/.test(rest)) contact.name = rest;
      else if (!contact.headline && wordCount(rest) <= 10 && !isTerminated(rest)) contact.headline = rest;
      else leftovers.push(rest);
    });
  });
  if (!contact.name) issues.push({ id: uid(), severity: "warning", section: "contact", message: "No name was detected at the top of the résumé. Add it in Contact." });
  if (!contact.email && !contact.phone) issues.push({ id: uid(), severity: "warning", section: "contact", message: "No email or phone number was detected. Add contact details." });
  if (contact.other.length) issues.push({ id: uid(), severity: "info", section: "contact", message: "Additional contact details were kept under Other links.", source: contact.other.join(" · ") });
  return { contact, leftovers };
}

/** Group a section's lines into entries: header lines followed by bullets. */
function groupEntries(lines: string[], isNewHeader: (line: string, entry: { header: string[]; bullets: string[] }) => boolean) {
  const entries: { header: string[]; bullets: string[]; paragraphs: string[] }[] = [];
  let blankBefore = false;
  for (const raw of lines) {
    if (!raw.trim()) {
      blankBefore = true;
      continue;
    }
    const text = raw.trim();
    let current = entries[entries.length - 1];
    if (isBullet(raw)) {
      if (!current) entries.push((current = { header: [], bullets: [], paragraphs: [] }));
      current.bullets.push(stripBullet(raw));
    } else if (!current) {
      entries.push({ header: [text], bullets: [], paragraphs: [] });
    } else if (current.bullets.length === 0 && !blankBefore && current.header.length < 4 && !(wordCount(text) > 12 && isTerminated(text)) && !isNewHeader(text, current)) {
      current.header.push(text);
    } else if (current.bullets.length === 0 && !blankBefore && wordCount(text) > 12 && isTerminated(text)) {
      current.paragraphs.push(text);
    } else {
      const lastBullet = current.bullets[current.bullets.length - 1] ?? current.paragraphs[current.paragraphs.length - 1];
      const continuation = !blankBefore && lastBullet !== undefined && (startsLowercase(text) || (!isTerminated(lastBullet) && !isNewHeader(text, current)));
      if (continuation) {
        if (current.bullets.length) current.bullets[current.bullets.length - 1] = `${lastBullet} ${text}`;
        else current.paragraphs[current.paragraphs.length - 1] = `${lastBullet} ${text}`;
      } else if (isNewHeader(text, current) || blankBefore || wordCount(text) <= 10) {
        entries.push({ header: [text], bullets: [], paragraphs: [] });
      } else current.paragraphs.push(text);
    }
    blankBefore = false;
  }
  return entries;
}

const headerish = (line: string) => Boolean(findDates(line)) || splitSegments(line).length > 1 || (wordCount(line) <= 8 && (ROLE_RE.test(line) || ORG_RE.test(line) || INSTITUTION_RE.test(line)));

function pullLocation(text: string) {
  const tail = text.match(LOCATION_TAIL_RE);
  if (!tail || tail.index === undefined) return { location: "", rest: text };
  return { location: tail[1].trim(), rest: text.slice(0, tail.index).replace(/[\s,|–—-]+$/, "").trim() };
}

function parseExperience(lines: string[], issues: ParseIssue[]): ExperienceEntry[] {
  const groups = groupEntries(lines, (line, entry) =>
    entry.bullets.length ? headerish(line) : Boolean(findDates(line)) && entry.header.some((existing) => findDates(existing)),
  );
  const entries: ExperienceEntry[] = [];
  for (const group of groups) {
    const entry: ExperienceEntry = { id: uid(), title: "", employer: "", location: "", startDate: "", endDate: "", current: false, bullets: [] };
    const segments: string[] = [];
    for (const line of group.header) {
      let rest = line;
      const dates = findDates(rest);
      if (dates && !entry.endDate && !entry.startDate) {
        if (dates.single) entry.startDate = dates.end;
        else Object.assign(entry, { startDate: dates.start, endDate: dates.end, current: dates.current });
        rest = dates.rest;
      }
      let parts = splitSegments(rest);
      parts = parts.flatMap((part) => {
        const { location, rest: remaining } = pullLocation(part);
        if (location && !entry.location) {
          entry.location = location;
          return remaining ? [remaining] : [];
        }
        return [part];
      });
      if (parts.length === 1 && / at /.test(parts[0])) parts = parts[0].split(/\s+at\s+/);
      else if (parts.length === 1 && parts[0].includes(",") && group.header.length === 1) parts = [parts[0].slice(0, parts[0].indexOf(",")), parts[0].slice(parts[0].indexOf(",") + 1)].map((part) => part.trim());
      segments.push(...parts.filter(Boolean));
    }
    const roleIndex = segments.findIndex((segment) => ROLE_RE.test(segment) && !ORG_RE.test(segment));
    const anyRoleIndex = roleIndex >= 0 ? roleIndex : segments.findIndex((segment) => ROLE_RE.test(segment));
    if (anyRoleIndex >= 0) entry.title = segments.splice(anyRoleIndex, 1)[0];
    const orgIndex = segments.findIndex((segment) => ORG_RE.test(segment));
    if (orgIndex >= 0) entry.employer = segments.splice(orgIndex, 1)[0];
    if (!entry.title && segments.length && !entry.employer) {
      entry.title = segments.shift()!;
      issues.push({ id: uid(), severity: "warning", section: "experience", message: `Check the job title and employer for "${entry.title}". They could not be told apart confidently.`, source: group.header.join(" / ") });
    }
    if (!entry.employer && segments.length) entry.employer = segments.shift()!;
    if (!entry.title && segments.length) entry.title = segments.shift()!;
    if (segments.length) {
      if (!entry.location && segments.length === 1 && LOCATION_RE.test(segments[0])) entry.location = segments.shift()!;
      else {
        entry.employer = [entry.employer, ...segments].filter(Boolean).join(", ");
        issues.push({ id: uid(), severity: "info", section: "experience", message: `Extra header text was added to the employer for "${entry.title || entry.employer}". Review it.`, source: segments.join(" · ") });
      }
    }
    entry.bullets = [...group.paragraphs, ...group.bullets];
    if (!entry.employer && entries.length && entry.title) {
      const previous = entries[entries.length - 1];
      if (previous.employer) {
        entry.employer = previous.employer;
        issues.push({ id: uid(), severity: "info", section: "experience", message: `"${entry.title}" had no employer line; it was linked to ${previous.employer}. Confirm this.`, source: group.header.join(" / ") });
      }
    }
    if (!group.header.length) issues.push({ id: uid(), severity: "warning", section: "experience", message: "Some bullets appeared before any job heading. Add the job title and employer.", source: group.bullets[0] });
    else if (!entry.startDate && !entry.endDate) issues.push({ id: uid(), severity: "warning", section: "experience", message: `No dates were found for "${entry.title || entry.employer}".`, source: group.header.join(" / ") });
    if (group.paragraphs.length) issues.push({ id: uid(), severity: "info", section: "experience", message: `Paragraph text under "${entry.title || entry.employer}" was kept as bullets. Consider shortening it.` });
    entries.push(entry);
  }
  return entries;
}

const TECH_LABEL_RE = /^(?:technologies|tech stack|tech|tools|built with|stack|languages)\s*[:\-–]\s*/i;

function parseProjects(lines: string[], issues: ParseIssue[]): ProjectEntry[] {
  const groups = groupEntries(lines, (line, entry) => entry.header.length > 0 && (Boolean(findDates(line)) && entry.header.some((existing) => findDates(existing)) || /^\S.{0,60}\s[|–—-]\s/.test(line) && entry.header.length >= 2));
  return groups.map((group) => {
    const project: ProjectEntry = { id: uid(), name: "", description: "", technologies: [], role: "", startDate: "", endDate: "", bullets: [], githubUrl: "", liveUrl: "" };
    const extra: string[] = [];
    group.header.forEach((line, index) => {
      let rest = line;
      let url = rest.match(URL_RE);
      while (url) {
        const value = normalizeUrl(url[0]);
        if (/github\.com/i.test(value) && !project.githubUrl) project.githubUrl = value;
        else if (!project.liveUrl) project.liveUrl = value;
        rest = rest.replace(url[0], " ");
        url = rest.match(URL_RE);
      }
      const dates = findDates(rest);
      if (dates) {
        project.startDate = dates.start;
        project.endDate = dates.end;
        rest = dates.rest;
      }
      if (TECH_LABEL_RE.test(rest)) {
        project.technologies.push(...splitList(rest.replace(TECH_LABEL_RE, "")));
        return;
      }
      const parts = splitSegments(rest.replace(/\b(?:GitHub|Live|Demo|Link)\s*[:]?\s*$/i, ""));
      parts.forEach((part, partIndex) => {
        const paren = part.match(/^(.*?)\s*\(([^)]+,[^)]+)\)\s*$/);
        if (index === 0 && partIndex === 0) {
          if (paren) {
            project.name = paren[1];
            project.technologies.push(...splitList(paren[2]));
          } else project.name = part.replace(/[:\s]+$/, "");
        } else if (TECH_LABEL_RE.test(part)) project.technologies.push(...splitList(part.replace(TECH_LABEL_RE, "")));
        else if (part.split(",").length >= 2 && part.split(",").every((piece) => wordCount(piece) <= 3)) project.technologies.push(...splitList(part));
        else if (!project.role && wordCount(part) <= 5 && ROLE_RE.test(part)) project.role = part;
        else extra.push(part);
      });
    });
    const bullets: string[] = [];
    for (const bullet of group.bullets) {
      if (TECH_LABEL_RE.test(bullet)) project.technologies.push(...splitList(bullet.replace(TECH_LABEL_RE, "")));
      else bullets.push(bullet);
    }
    project.description = [...extra, ...group.paragraphs].join(" ");
    project.bullets = bullets;
    project.technologies = dedupe(project.technologies);
    if (!project.name) {
      project.name = project.description.split(/[.:]/)[0].slice(0, 60);
      issues.push({ id: uid(), severity: "warning", section: "projects", message: "A project without a clear name was found. Check the project title.", source: (group.header[0] || group.bullets[0] || "").slice(0, 120) });
    }
    return project;
  });
}

function parseEducation(lines: string[], issues: ParseIssue[]): EducationEntry[] {
  const groups = groupEntries(lines, (line, entry) => entry.header.length > 0 && INSTITUTION_RE.test(line) && entry.header.some((existing) => INSTITUTION_RE.test(existing)));
  return groups.map((group) => {
    const entry: EducationEntry = { id: uid(), institution: "", degree: "", field: "", location: "", startDate: "", endDate: "", gpa: "", details: [] };
    const leftovers: string[] = [];
    for (const line of group.header) {
      let rest = line;
      const gpa = rest.match(GPA_RE);
      if (gpa) {
        entry.gpa = gpa[1].replace(/\s+/g, "");
        rest = rest.replace(gpa[0], " ");
      }
      const dates = findDates(rest);
      if (dates && !entry.endDate) {
        entry.startDate = dates.start;
        entry.endDate = dates.end;
        rest = dates.rest;
      }
      const segments = splitSegments(rest).flatMap((segment) => {
        const degree = segment.match(DEGREE_RE);
        // "Ohio State University Bachelor of Science" → institution and degree.
        return degree?.index && INSTITUTION_RE.test(segment.slice(0, degree.index)) ? [segment.slice(0, degree.index).trim(), segment.slice(degree.index).trim()] : [segment];
      });
      for (const raw of segments) {
        const { location, rest: part } = pullLocation(raw);
        if (location && !entry.location) entry.location = location;
        if (!part) continue;
        if (!entry.institution && INSTITUTION_RE.test(part) && !DEGREE_RE.test(part.replace(INSTITUTION_RE, ""))) entry.institution = part;
        else if (!entry.degree && DEGREE_RE.test(part)) {
          const match = part.match(/^(.*?)\s+in\s+(.+)$/i) || part.match(/^(.*?),\s*(.+)$/);
          if (match) {
            entry.degree = match[1].trim();
            entry.field = match[2].trim();
          } else entry.degree = part;
        } else if (!entry.institution && INSTITUTION_RE.test(part)) entry.institution = part;
        else leftovers.push(part);
      }
    }
    if (!entry.institution && leftovers.length) entry.institution = leftovers.shift()!;
    if (!entry.degree && leftovers.length && wordCount(leftovers[0]) <= 8) entry.degree = leftovers.shift()!;
    entry.details = [...leftovers, ...group.paragraphs, ...group.bullets];
    if (!entry.institution || !entry.degree)
      issues.push({ id: uid(), severity: "warning", section: "education", message: `Check the school and degree for "${entry.institution || entry.degree || "an education entry"}".`, source: group.header.join(" / ") });
    return entry;
  });
}

function parseCertifications(lines: string[]): CertificationEntry[] {
  return toItems(lines).map((item) => {
    const cert: CertificationEntry = { id: uid(), name: "", issuer: "", date: "", credentialId: "" };
    let rest = item;
    const credential = rest.match(/\b(?:Credential|Cert(?:ification)?|License)\s*(?:ID|#|No\.?)[:\s#]*([A-Z0-9-]{4,})/i);
    if (credential) {
      cert.credentialId = credential[1];
      rest = rest.replace(credential[0], " ");
    }
    const dates = findDates(rest);
    if (dates) {
      cert.date = dates.start ? `${dates.start} – ${dates.end}` : dates.end;
      rest = dates.rest;
    }
    const issued = rest.match(/^(.*?)\s*(?:,|\||–|—|-)?\s*(?:issued by|by)\s+(.+)$/i);
    const parts = issued ? [issued[1], issued[2]] : splitSegments(rest);
    const paren = !issued && parts.length === 1 ? parts[0].match(/^(.*?)\s*\(([^)]+)\)$/) : null;
    if (paren) {
      cert.name = paren[1].trim();
      cert.issuer = paren[2].trim();
    } else if (parts.length === 1 && parts[0].includes(", ")) {
      // "CompTIA A+, CompTIA" is the renderer's own "name, issuer" format.
      const split = parts[0].lastIndexOf(", ");
      cert.name = parts[0].slice(0, split).trim();
      cert.issuer = parts[0].slice(split + 2).trim();
    } else {
      cert.name = (parts[0] || rest).trim();
      cert.issuer = parts.slice(1).join(", ").trim();
    }
    return cert;
  });
}

const dedupe = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function dedupeSkills(categories: SkillCategory[]): { categories: SkillCategory[]; removed: string[] } {
  const seen = new Set<string>();
  const removed: string[] = [];
  const result = categories
    .map((category) => ({
      ...category,
      name: category.name.trim(),
      skills: category.skills
        .map((skill) => skill.trim())
        .filter((skill) => {
          if (!skill) return false;
          const key = skill.toLowerCase();
          if (seen.has(key)) {
            removed.push(skill);
            return false;
          }
          seen.add(key);
          return true;
        }),
    }))
    .filter((category) => category.skills.length || category.name);
  return { categories: result, removed };
}

function parseSkills(lines: string[], issues: ParseIssue[]): SkillCategory[] {
  const categories: SkillCategory[] = [];
  const general: string[] = [];
  for (const item of toItems(lines)) {
    const labelled = item.match(/^([A-Za-z][A-Za-z /&+#.-]{1,40}?)\s*[:–—]\s+(.+)$/);
    if (labelled) {
      const name = labelled[1].trim();
      const existing = categories.find((category) => category.name.toLowerCase() === name.toLowerCase());
      if (existing) existing.skills.push(...splitList(labelled[2]));
      else categories.push({ id: uid(), name, skills: splitList(labelled[2]) });
    } else {
      const list = splitList(item);
      if (list.length === 1 && wordCount(item) > 6) issues.push({ id: uid(), severity: "info", section: "skills", message: "A long line in Skills was kept as one item. Split it into individual skills if needed.", source: item });
      general.push(...list);
    }
  }
  if (general.length) categories.push({ id: uid(), name: categories.length ? "Other" : "Skills", skills: general });
  const { categories: deduped, removed } = dedupeSkills(categories);
  if (removed.length) issues.push({ id: uid(), severity: "info", section: "skills", message: `Removed ${removed.length} duplicate skill${removed.length === 1 ? "" : "s"}.`, source: removed.join(", ") });
  return deduped;
}

export function parseResumeText(text: string): ParseResult {
  const issues: ParseIssue[] = [];
  const resume = emptyResume();
  const { lines, collapsed } = normalizeLines(text);
  if (collapsed)
    issues.push({ id: uid(), severity: "warning", section: "extraction", message: "The imported text had very few line breaks, so its structure was reconstructed. Check every section against the original file." });

  const { header, sections } = splitSections(lines);
  const { contact, leftovers } = parseContact(header, issues);
  resume.contact = contact;

  if (!sections.length) {
    issues.push({ id: uid(), severity: "warning", section: "extraction", message: "No standard section headings (Experience, Education, Skills…) were found. The text was kept under Imported content for you to organize." });
    const body = header.filter((line) => line.trim()).slice(1);
    if (body.length) resume.custom.push({ id: uid(), title: "Imported content", items: simpleItems(body) });
    return { resume, issues };
  }

  if (leftovers.length) {
    const long = leftovers.filter((line) => wordCount(line) > 10);
    const short = leftovers.filter((line) => wordCount(line) <= 10);
    if (long.length && !sections.some((section) => section.kind === "summary")) {
      resume.summary = long.join(" ");
      issues.push({ id: uid(), severity: "info", section: "summary", message: "Introductory text near the header was used as the professional summary." });
    } else if (long.length) short.push(...long);
    if (short.length) {
      resume.custom.push({ id: uid(), title: "Additional information", items: short.map((line) => ({ id: uid(), text: line })) });
      issues.push({ id: uid(), severity: "info", section: "contact", message: "Some header lines did not match a contact field and were kept under Additional information.", source: short.join(" · ") });
    }
  }

  for (const section of sections) {
    const content = section.lines.filter((line) => line.trim());
    if (!content.length) {
      issues.push({ id: uid(), severity: "info", section: section.kind === "custom" ? "extraction" : section.kind, message: `The "${section.title}" heading had no content under it.` });
      continue;
    }
    switch (section.kind) {
      case "summary":
        resume.summary = [resume.summary, toItems(section.lines).join(" ")].filter(Boolean).join(" ");
        break;
      case "skills":
        resume.skills.push(...parseSkills(section.lines, issues));
        break;
      case "experience":
        resume.experience.push(...parseExperience(section.lines, issues));
        break;
      case "projects":
        resume.projects.push(...parseProjects(section.lines, issues));
        break;
      case "education":
        resume.education.push(...parseEducation(section.lines, issues));
        break;
      case "certifications":
        resume.certifications.push(...parseCertifications(section.lines));
        break;
      case "awards":
        resume.awards.push(...simpleItems(section.lines));
        break;
      case "publications":
        resume.publications.push(...simpleItems(section.lines));
        break;
      default: {
        const existing = resume.custom.find((custom) => custom.title.toLowerCase() === section.title.toLowerCase());
        if (existing) existing.items.push(...simpleItems(section.lines));
        else resume.custom.push({ id: uid(), title: section.title, items: simpleItems(section.lines) });
      }
    }
  }
  if (resume.skills.length > 1) resume.skills = dedupeSkills(resume.skills).categories;
  return { resume, issues };
}

/** Lines of text that ended up somewhere in the structured résumé, for coverage checks. */
export function resumeToPlainText(resume: Resume): string {
  const { contact } = resume;
  const parts: string[] = [
    contact.name,
    contact.headline,
    [contact.email, contact.phone, contact.location, contact.linkedin, contact.github, contact.website, ...contact.other].filter(Boolean).join(" | "),
    resume.summary,
    ...resume.skills.map((category) => `${category.name}: ${category.skills.join(", ")}`),
    ...resume.experience.flatMap((entry) => [[entry.title, entry.employer, entry.location, entry.startDate, entry.endDate].filter(Boolean).join(" | "), ...entry.bullets]),
    ...resume.projects.flatMap((entry) => [[entry.name, entry.role, entry.technologies.join(", "), entry.githubUrl, entry.liveUrl, entry.startDate, entry.endDate].filter(Boolean).join(" | "), entry.description, ...entry.bullets]),
    ...resume.education.flatMap((entry) => [[entry.degree, entry.field, entry.institution, entry.location, entry.startDate, entry.endDate, entry.gpa && `GPA ${entry.gpa}`].filter(Boolean).join(" | "), ...entry.details]),
    ...resume.certifications.map((cert) => [cert.name, cert.issuer, cert.date, cert.credentialId].filter(Boolean).join(" | ")),
    ...resume.awards.map((item) => item.text),
    ...resume.publications.map((item) => item.text),
    ...resume.custom.flatMap((section) => [section.title, ...section.items.map((item) => item.text)]),
  ];
  return parts.filter((part) => part && part.trim()).join("\n");
}
