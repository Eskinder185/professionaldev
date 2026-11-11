import { PLATFORM_ADAPTERS } from "../../../../packages/careeros-shared/adapters";
import type {
  AutoApplyQueueItem,
  CoverLetterField,
  CoverLetterState,
  DetectedField,
  JobPageInfo,
  PageContext,
  PageStage,
  PlatformId,
  SharedProfileSubset,
} from "../../../../packages/careeros-shared/types";
import { selectPlatformAdapter } from "../adapters";
import { deepQuery } from "../../../../packages/careeros-shared/dom/deepQuery";
import { findEmbeddedApplicationFrames } from "../page-intelligence/embeddedFrames";
import { extractJobDescription, structuredText, type DescriptionResult } from "../page-intelligence/jobDescription";
import { buildJobIntelligence } from "../page-intelligence/jobIntelligence";

const CLOSED_PATTERNS = [
  /no longer accepting applications/i,
  /this (?:job|position|posting|role) (?:is|has been) (?:closed|filled|no longer available)/i,
  /this job is no longer available/i,
  /position has been filled/i,
  /applications? (?:for this (?:job|role) )?(?:are|is) closed/i,
];

const SALARY_RANGE =
  /(?:[$€£]\s?\d{2,3}(?:,\d{3})+(?:\.\d+)?|[$€£]\s?\d{2,3}(?:\.\d+)?\s?[kK])\s*(?:-|–|—|to)\s*(?:[$€£]\s?)?\d{2,3}(?:,\d{3})*(?:\.\d+)?\s?[kK]?(?:\s*(?:\/|per\s)\s*(?:year|yr|hour|hr|annum))?/;

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function firstText(doc: Document | HTMLElement, selectors: string[]): string {
  for (const sel of selectors) {
    const el = doc.querySelector<HTMLElement>(sel);
    const t = clean(el?.textContent);
    if (t) return t;
  }
  return "";
}

function formatMoney(n: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
  return `${symbol}${Math.round(n).toLocaleString("en-US")}`;
}

interface JsonLdJob {
  title?: string;
  company?: string;
  location?: string;
  salary?: string | null;
  description?: string;
  expired?: boolean;
  employmentType?: string;
  workArrangement?: string;
  jobId?: string;
  applicationUrl?: string;
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACTOR: "Contract",
  TEMPORARY: "Temporary",
  INTERN: "Internship",
  VOLUNTEER: "Volunteer",
  PER_DIEM: "Per diem",
  OTHER: "Other",
};

/** Employment type exactly as the posting states it, in plain words. */
function readEmploymentType(value: unknown): string | undefined {
  const list = Array.isArray(value) ? value : [value];
  const labels = list
    .filter((item): item is string => typeof item === "string" && item.trim() !== "")
    .map((item) => EMPLOYMENT_LABELS[item.trim().toUpperCase()] ?? clean(item));
  return labels.length ? Array.from(new Set(labels)).join(", ") : undefined;
}

/**
 * A JSON-LD description is HTML (sometimes stored escaped, as "&lt;p&gt;"). Read it as HTML so its
 * headings and bullets survive; flattening it would make every requirement look the same.
 */
function descriptionFromHtml(raw: string): string {
  if (typeof DOMParser === "undefined") return clean(raw.replace(/<[^>]+>/g, " "));
  const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
  let body = parse(raw).body;
  const decoded = body.textContent ?? "";
  if (!body.querySelector("p, li, ul, ol, h1, h2, h3, h4, br, div") && /<(p|li|ul|ol|h[1-6]|br|div)\b/i.test(decoded)) body = parse(decoded).body;
  return structuredText(body);
}

function readJobId(identifier: unknown): string | undefined {
  if (typeof identifier === "string" || typeof identifier === "number") return clean(String(identifier)) || undefined;
  if (identifier && typeof identifier === "object") {
    const value = (identifier as { value?: unknown }).value;
    if (typeof value === "string" || typeof value === "number") return clean(String(value)) || undefined;
  }
  return undefined;
}

function parseJsonLd(doc: Document | HTMLElement): JsonLdJob | null {
  const scripts = Array.from(doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
  for (const script of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent ?? "");
    } catch {
      continue;
    }
    const nodes: unknown[] = Array.isArray(data)
      ? data
      : data && typeof data === "object" && Array.isArray((data as { "@graph"?: unknown[] })["@graph"])
        ? (data as { "@graph": unknown[] })["@graph"]
        : [data];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      const type = n["@type"];
      const isJob = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
      if (!isJob) continue;

      const org = n.hiringOrganization as Record<string, unknown> | string | undefined;
      const company = typeof org === "string" ? org : typeof org?.name === "string" ? org.name : "";

      const loc = Array.isArray(n.jobLocation) ? n.jobLocation[0] : n.jobLocation;
      let location = "";
      if (loc && typeof loc === "object") {
        const addr = (loc as { address?: unknown }).address;
        if (typeof addr === "string") location = addr;
        else if (addr && typeof addr === "object") {
          const a = addr as Record<string, unknown>;
          location = [a.addressLocality, a.addressRegion, a.addressCountry]
            .filter((x): x is string => typeof x === "string" && x.length > 0)
            .join(", ");
        }
      }
      if (!location && n.jobLocationType === "TELECOMMUTE") location = "Remote";

      let salary: string | null = null;
      const base = n.baseSalary as Record<string, unknown> | undefined;
      if (base && typeof base === "object") {
        const currency = typeof base.currency === "string" ? base.currency : "USD";
        const v = base.value as Record<string, unknown> | number | undefined;
        const unitRaw = typeof v === "object" && v && typeof v.unitText === "string" ? v.unitText : "";
        const unit = unitRaw ? ` / ${unitRaw.toLowerCase()}` : "";
        if (v && typeof v === "object") {
          const min = Number(v.minValue);
          const max = Number(v.maxValue);
          const single = Number(v.value);
          if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
            salary = `${formatMoney(min, currency)}–${formatMoney(max, currency)}${unit}`;
          } else if (Number.isFinite(single) && single > 0) {
            salary = `${formatMoney(single, currency)}${unit}`;
          }
        }
      }

      const validThrough = typeof n.validThrough === "string" ? Date.parse(n.validThrough) : NaN;
      return {
        title: typeof n.title === "string" ? clean(n.title) : "",
        company: clean(company),
        location: clean(location),
        salary,
        description: typeof n.description === "string" ? descriptionFromHtml(n.description) : "",
        expired: Number.isFinite(validThrough) && validThrough < Date.now(),
        employmentType: readEmploymentType(n.employmentType),
        workArrangement: n.jobLocationType === "TELECOMMUTE" ? "Remote" : undefined,
        jobId: readJobId(n.identifier),
        applicationUrl: typeof n.url === "string" && /^https:\/\//i.test(n.url) ? n.url : undefined,
      };
    }
  }
  return null;
}

function splitTitleCompany(raw: string): { title: string; company: string } {
  const text = clean(raw);
  const parts = text.split(/\s+(?:—|–|-|\||at)\s+/);
  if (parts.length >= 2) return { title: parts[0], company: parts.slice(1).join(" — ") };
  return { title: text, company: "" };
}

/** Extracts job details only from evidence on the page. Anything not found is left empty. */
export function extractJobInfo(
  doc: Document | HTMLElement,
  url: string,
  platform: PlatformId,
  platformLabel: string,
  hasForm = false,
): JobPageInfo | null {
  const sources: Record<string, string> = {};
  const ld = parseJsonLd(doc);

  let title = ld?.title ?? "";
  let company = ld?.company ?? "";
  let location = ld?.location ?? "";
  if (title) sources.title = "JSON-LD JobPosting";
  if (company) sources.company = "JSON-LD JobPosting";
  if (location) sources.location = "JSON-LD JobPosting";

  const platformSelectors: Record<string, { title: string[]; company: string[]; location: string[] }> = {
    greenhouse: {
      title: [".app-title", "h1.section-header", "#header .heading", "h1"],
      company: [".company-name", "#header .company-name"],
      location: [".location", ".job__location"],
    },
    lever: {
      title: [".posting-headline h2", "h2"],
      company: [".main-header-logo img[alt]"],
      location: [".posting-categories .location", ".sort-by-time.posting-category .location"],
    },
    ashby: { title: ["h1"], company: [], location: [] },
    workday: {
      title: ['[data-automation-id="jobPostingHeader"]', "h1"],
      company: [],
      location: ['[data-automation-id="locations"]'],
    },
  };
  const sel = platformSelectors[platform];
  if (sel) {
    if (!title) {
      title = firstText(doc, sel.title);
      if (title) sources.title = `${platformLabel} page heading`;
    }
    if (!company) {
      const logo = sel.company.length ? doc.querySelector<HTMLElement>(sel.company[0]) : null;
      company = firstText(doc, sel.company) || clean(logo?.getAttribute("alt"));
      if (company) sources.company = `${platformLabel} page`;
    }
    if (!location) {
      location = firstText(doc, sel.location);
      if (location) sources.location = `${platformLabel} page`;
    }
  }

  // Generic fallback: a "Role — Company" heading. On an unrecognised site this is only trusted when
  // the page also contains an application form, so ordinary pages never become "job cards".
  const jobish = /\b(apply|application|job|jobs|career|careers|position|role|engineer|developer|manager|analyst|specialist|technician|administrator)\b/i;
  const heading = firstText(doc, ["h1"]);
  const trustHeading =
    platform !== "generic" ||
    (hasForm && jobish.test(`${heading} ${(doc as Document).title ?? ""} ${url}`));
  if (trustHeading && (!title || !company)) {
    const h1 = heading;
    if (h1) {
      const split = splitTitleCompany(h1);
      if (platform === "generic" && !split.company) {
        // A bare heading with no company is not evidence of a job posting.
      } else if (!title && split.title) {
        title = split.title;
        sources.title = "Page heading";
      }
      if (!company && split.company) {
        company = split.company;
        sources.company = "Page heading";
      }
    }
  }
  if (!company && trustHeading) {
    const og = doc.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content;
    if (og && clean(og)) {
      company = clean(og);
      sources.company = "og:site_name";
    }
  }
  if (!location) {
    const el = doc.querySelector<HTMLElement>('[data-testid="job-location"], [itemprop="jobLocation"]');
    const t = clean(el?.textContent).split("·")[0].trim();
    if (t) {
      location = t;
      sources.location = "Page location element";
    }
  }

  // Salary: structured data, or an explicit range inside a compensation-labelled element.
  let salary: string | null = ld?.salary ?? null;
  if (salary) sources.salary = "JSON-LD baseSalary";
  if (!salary) {
    const comp = doc.querySelector<HTMLElement>(
      '[data-testid="job-salary"], [class*="salary" i], [class*="compensation" i], [data-automation-id*="salary" i]',
    );
    const m = clean(comp?.textContent).match(SALARY_RANGE);
    if (m) {
      salary = clean(m[0]);
      sources.salary = "Compensation text on page";
    }
  }

  if (!title && !company) return null;

  const bodyText = clean(
    (doc as Document).body?.textContent ?? (doc as HTMLElement).textContent ?? "",
  ).slice(0, 20000);
  let closedEvidence: string | null = null;
  if (ld?.expired) closedEvidence = "Posting marks a validThrough date in the past.";
  else {
    for (const pattern of CLOSED_PATTERNS) {
      const m = bodyText.match(pattern);
      if (m) {
        closedEvidence = m[0];
        break;
      }
    }
  }

  return {
    title,
    company,
    location,
    salary,
    platform,
    platformLabel,
    url,
    sources,
    closedEvidence,
    description: ld?.description ?? "",
    ...(ld?.employmentType ? { employmentType: ld.employmentType } : {}),
    ...(ld?.workArrangement ? { workArrangement: ld.workArrangement } : {}),
    ...(ld?.jobId ? { jobId: ld.jobId } : {}),
    ...(ld?.applicationUrl ? { applicationUrl: ld.applicationUrl } : {}),
  };
}

const COVER_RE = /cover[\s_-]*letter/i;

export function detectCoverLetter(fields: DetectedField[]): {
  state: CoverLetterState;
  field: CoverLetterField | null;
} {
  const coverFields = fields.filter((f) => {
    const hay = `${f.label} ${f.nameAttr} ${f.idAttr} ${f.placeholder}`;
    return COVER_RE.test(hay) || f.mappedKey === "coverLetter";
  });
  const textual = coverFields.find((f) => f.inputType !== "file");
  const file = coverFields.find((f) => f.inputType === "file");
  const chosen = textual ?? file;
  if (!chosen) return { state: "none", field: null };
  const asField: CoverLetterField = {
    fieldId: chosen.id,
    label: chosen.label,
    inputType: chosen.inputType,
    required: chosen.required || /\(required\)/i.test(chosen.label),
    currentDomValue: chosen.currentDomValue,
  };
  if (!textual && file) return { state: "file-only", field: asField };
  return { state: asField.required ? "required" : "optional", field: asField };
}

function detectSignIn(doc: Document | HTMLElement, fields: DetectedField[]): boolean {
  const password = doc.querySelector<HTMLInputElement>('input[type="password"]');
  if (!password) return false;
  const text = clean(
    password.closest("form")?.textContent ?? (doc as Document).body?.textContent ?? "",
  ).slice(0, 3000);
  const looksLikeLogin = /sign[\s-]?in|log[\s-]?in|create account/i.test(text);
  const profileFields = fields.filter(
    (f) => f.inputType !== "unknown" && f.mappedKey && f.mappedKey !== "customQuestion",
  );
  return looksLikeLogin && profileFields.length <= 3;
}

/** Reads validation problems the page itself is showing, without changing anything. */
export function collectValidationIssues(doc: Document | HTMLElement, fields: DetectedField[]): string[] {
  const issues: string[] = [];
  for (const f of fields) {
    let el: HTMLInputElement | null;
    try {
      el = deepQuery<HTMLInputElement>(doc, f.selector);
    } catch {
      el = null;
    }
    if (!el || typeof el.value !== "string" || el.value === "") continue;
    if (el.validity && !el.validity.valid) {
      f.validationError = el.validationMessage;
      issues.push(`${f.label}: ${el.validationMessage}`);
    }
  }
  doc.querySelectorAll<HTMLElement>('[role="alert"], [data-testid="sandbox-validation-error"]').forEach((node) => {
    const t = clean(node.textContent);
    if (t && t.length < 240 && !issues.includes(t)) issues.push(t);
  });
  return issues;
}

export function detectPageContext(
  doc: Document,
  urlStr: string,
  profile: SharedProfileSubset | null,
  activeApp: AutoApplyQueueItem | null,
): PageContext {
  const adapter = selectPlatformAdapter(urlStr, doc);
  const spec = PLATFORM_ADAPTERS[adapter.id] ?? PLATFORM_ADAPTERS.generic;
  let hostname: string;
  try {
    hostname = new URL(urlStr).hostname;
  } catch {
    hostname = "";
  }

  const supported = adapter.supportLevel !== "unsupported";
  const fields = supported ? adapter.discover(doc, profile) : [];

  // Merge prepared questions so field readiness matches what the autofill run will use.
  let fieldsForContext = fields;
  if (supported && activeApp?.preparedQuestions?.length && profile) {
    const merged: SharedProfileSubset = { ...profile, preparedAnswers: { ...(profile.preparedAnswers ?? {}) } };
    for (const q of activeApp.preparedQuestions) {
      merged.preparedAnswers![q.id] = {
        question: q.question,
        answer: q.draftAnswer,
        evidence: q.evidence,
        approved: q.approved,
      };
    }
    fieldsForContext = adapter.discover(doc, merged);
  }

  const confirmation = adapter.detectConfirmation(doc);
  const stage: PageStage = confirmation.confirmed
    ? "completion_confirmed"
    : fieldsForContext.length > 0
      ? "fields_identified"
      : "page_detected";

  const job = supported
    ? extractJobInfo(doc, urlStr, adapter.id, adapter.label, fieldsForContext.length > 0)
    : null;

  // The description: structured data first, otherwise the page's own description section.
  let descriptionFound: DescriptionResult | null = null;
  if (job && !job.description) {
    descriptionFound = extractJobDescription(doc, adapter.id, adapter.label, adapter.id !== "generic" || fieldsForContext.length > 0);
    if (descriptionFound) {
      job.description = descriptionFound.text;
      job.sources.description = descriptionFound.source;
    }
  }
  const intelligence = job ? buildJobIntelligence(job, adapter.id, fieldsForContext.length > 0, descriptionFound) : null;
  const embeddedFrames = findEmbeddedApplicationFrames(doc, urlStr);

  return {
    supported,
    url: urlStr,
    hostname,
    platform: adapter.id,
    platformLabel: spec.label,
    supportLevel: adapter.supportLevel,
    job,
    pageStage: stage,
    fields: fieldsForContext,
    coverLetter: detectCoverLetter(fieldsForContext),
    needsSignIn: detectSignIn(doc, fieldsForContext),
    confirmed: confirmation.confirmed,
    validationIssues: collectValidationIssues(doc, fieldsForContext),
    detectedAt: new Date().toISOString(),
    intelligence,
    embeddedFrames,
  };
}
