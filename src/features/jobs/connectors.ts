import { detectArrangement, extractSalary, htmlToText, splitSections } from "./text";
import { toEmployment, type BoardConnection, type EmploymentType, type JobPosting, type Salary } from "./schema";

/**
 * Employer job-board connectors. Each reads an employer's own public job-board feed
 * (the same data their careers page shows). They run in the browser, need no key, and the
 * three feeds send `Access-Control-Allow-Origin: *`, so a static host such as GitHub Pages works.
 * Nothing is scraped, nothing is gated, and no listings are fabricated.
 */

export type Fetch = typeof fetch;
export const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const TIMEOUT_MS = 20_000;
const MAX_JOBS = 400;

export class ConnectorError extends Error {}

export const BOARD_KINDS: Array<{ kind: BoardConnection["kind"]; label: string; hint: string }> = [
  { kind: "greenhouse", label: "Greenhouse", hint: "boards.greenhouse.io/TOKEN" },
  { kind: "lever", label: "Lever", hint: "jobs.lever.co/TOKEN" },
  { kind: "ashby", label: "Ashby", hint: "jobs.ashbyhq.com/TOKEN" },
];

export function parseBoardInput(input: string): { kind: BoardConnection["kind"]; token: string } | null {
  const t = input.trim();
  try {
    const u = new URL(t);
    const first = u.pathname.split("/").filter(Boolean)[0] ?? "";
    if (/greenhouse\.io$/i.test(u.hostname) && TOKEN_RE.test(first)) return { kind: "greenhouse", token: first };
    if (/(^|\.)lever\.co$/i.test(u.hostname) && TOKEN_RE.test(first)) return { kind: "lever", token: first };
    if (/(^|\.)ashbyhq\.com$/i.test(u.hostname) && TOKEN_RE.test(first)) return { kind: "ashby", token: first };
  } catch {
    /* not a URL */
  }
  return null;
}

async function getJson(fetchImpl: Fetch, url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: "application/json" }, credentials: "omit" });
    if (res.status === 404) throw new ConnectorError("That job board was not found. Check the token from the employer's careers URL.");
    if (!res.ok) throw new ConnectorError(`The job board responded with HTTP ${res.status}.`);
    return await res.json();
  } catch (e) {
    if (e instanceof ConnectorError) throw e;
    if ((e as Error)?.name === "AbortError") throw new ConnectorError("The job board took too long to respond.");
    throw new ConnectorError("Could not reach the job board. Check your connection or try again later.");
  } finally {
    clearTimeout(timer);
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const iso = (v: unknown): string | null => {
  const t = typeof v === "number" ? v : Date.parse(str(v));
  return Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : null;
};
const isHttp = (u: string) => /^https?:\/\//i.test(u);

function build(base: Omit<JobPosting, "about" | "responsibilities" | "requirements" | "benefits" | "description" | "salary" | "workArrangement"> & { descriptionText: string; salary: Salary | null; arrangementHint?: string }): JobPosting {
  const { descriptionText, arrangementHint, salary, ...rest } = base;
  const sections = splitSections(descriptionText);
  return {
    ...rest,
    description: descriptionText,
    about: sections.about,
    responsibilities: sections.responsibilities,
    requirements: sections.requirements,
    benefits: sections.benefits,
    salary: salary ?? extractSalary(descriptionText),
    workArrangement: detectArrangement(arrangementHint, rest.location),
  };
}

export async function fetchGreenhouse(token: string, fetchImpl: Fetch = (...a) => fetch(...a)): Promise<{ companyName: string; jobs: JobPosting[] }> {
  if (!TOKEN_RE.test(token)) throw new ConnectorError("Invalid board token.");
  const data = (await getJson(fetchImpl, `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`)) as { jobs?: unknown };
  if (!data || !Array.isArray(data.jobs)) throw new ConnectorError("The board returned an unexpected response.");
  let companyName = "";
  const jobs: JobPosting[] = [];
  for (const raw of data.jobs.slice(0, MAX_JOBS)) {
    const j = raw as Record<string, unknown>;
    const id = j.id != null ? String(j.id) : "";
    const title = str(j.title);
    const url = str(j.absolute_url);
    if (!id || !title || !isHttp(url)) continue;
    companyName ||= str(j.company_name);
    const departments = Array.isArray(j.departments) ? (j.departments as Array<{ name?: unknown }>) : [];
    const loc = str((j.location as { name?: unknown } | undefined)?.name);
    jobs.push(
      build({
        id: `greenhouse:${token}:${id}`,
        source: "greenhouse",
        boardId: `greenhouse:${token}`,
        externalId: id,
        title,
        company: str(j.company_name) || companyName || token,
        location: loc,
        employmentType: "unspecified" as EmploymentType,
        category: str(departments[0]?.name),
        postedAt: iso(j.first_published) ?? iso(j.updated_at),
        verifiedSource: true,
        url,
        applyUrl: url,
        skills: [],
        addedAt: new Date().toISOString(),
        descriptionText: htmlToText(str(j.content)),
        salary: null,
      }),
    );
  }
  return { companyName: companyName || token, jobs };
}

export async function fetchLever(token: string, fetchImpl: Fetch = (...a) => fetch(...a)): Promise<{ companyName: string; jobs: JobPosting[] }> {
  if (!TOKEN_RE.test(token)) throw new ConnectorError("Invalid board token.");
  const data = await getJson(fetchImpl, `https://api.lever.co/v0/postings/${token}?mode=json`);
  if (!Array.isArray(data)) throw new ConnectorError("The board returned an unexpected response.");
  const jobs: JobPosting[] = [];
  for (const raw of data.slice(0, MAX_JOBS)) {
    const j = raw as Record<string, unknown>;
    const id = str(j.id);
    const title = str(j.text);
    const url = str(j.hostedUrl);
    if (!id || !title || !isHttp(url)) continue;
    const cats = (j.categories ?? {}) as Record<string, unknown>;
    const lists = Array.isArray(j.lists) ? (j.lists as Array<{ text?: unknown; content?: unknown }>) : [];
    const listText = lists.map((l) => `${str(l.text)}\n${htmlToText(str(l.content))}`).join("\n");
    const body = [str(j.descriptionPlain) || htmlToText(str(j.description)), listText, str(j.additionalPlain)].filter(Boolean).join("\n\n");
    const sr = j.salaryRange as { min?: unknown; max?: unknown; currency?: unknown; interval?: unknown } | undefined;
    const salary: Salary | null =
      sr && typeof sr.min === "number" && typeof sr.max === "number"
        ? { min: sr.min, max: sr.max, currency: str(sr.currency) || "USD", period: /hour/i.test(str(sr.interval)) ? "hour" : /month/i.test(str(sr.interval)) ? "month" : "year", text: "" }
        : null;
    jobs.push(
      build({
        id: `lever:${token}:${id}`,
        source: "lever",
        boardId: `lever:${token}`,
        externalId: id,
        title,
        company: token,
        location: str(cats.location),
        employmentType: toEmployment(str(cats.commitment)),
        category: str(cats.department) || str(cats.team),
        postedAt: iso(j.createdAt),
        verifiedSource: true,
        url,
        applyUrl: isHttp(str(j.applyUrl)) ? str(j.applyUrl) : url,
        skills: [],
        addedAt: new Date().toISOString(),
        descriptionText: body,
        salary,
        arrangementHint: str(j.workplaceType),
      }),
    );
  }
  return { companyName: token, jobs };
}

export async function fetchAshby(token: string, fetchImpl: Fetch = (...a) => fetch(...a)): Promise<{ companyName: string; jobs: JobPosting[] }> {
  if (!TOKEN_RE.test(token)) throw new ConnectorError("Invalid board token.");
  const data = (await getJson(fetchImpl, `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`)) as { jobs?: unknown };
  if (!data || !Array.isArray(data.jobs)) throw new ConnectorError("The board returned an unexpected response.");
  const jobs: JobPosting[] = [];
  for (const raw of data.jobs.slice(0, MAX_JOBS)) {
    const j = raw as Record<string, unknown>;
    const title = str(j.title);
    const url = str(j.jobUrl);
    if (!title || !isHttp(url) || j.isListed === false) continue;
    const id = url.split("/").filter(Boolean).pop() ?? "";
    const comp = (j.compensation ?? {}) as { scrapeableCompensationSalarySummary?: unknown; compensationTierSummary?: unknown };
    const compText = str(comp.scrapeableCompensationSalarySummary) || str(comp.compensationTierSummary);
    const body = str(j.descriptionPlain) || htmlToText(str(j.descriptionHtml));
    jobs.push(
      build({
        id: `ashby:${token}:${id}`,
        source: "ashby",
        boardId: `ashby:${token}`,
        externalId: id,
        title,
        company: token,
        location: str(j.location),
        employmentType: toEmployment(str(j.employmentType).replace(/([a-z])([A-Z])/g, "$1-$2")),
        category: str(j.department) || str(j.team),
        postedAt: iso(j.publishedAt),
        verifiedSource: true,
        url,
        applyUrl: isHttp(str(j.applyUrl)) ? str(j.applyUrl) : url,
        skills: [],
        addedAt: new Date().toISOString(),
        descriptionText: body,
        salary: extractSalary(compText) ?? (compText ? { min: null, max: null, currency: "USD", period: null, text: compText } : null),
        arrangementHint: j.isRemote === true ? "remote" : str(j.workplaceType),
      }),
    );
  }
  return { companyName: token, jobs };
}

export async function fetchBoard(kind: BoardConnection["kind"], token: string, fetchImpl?: Fetch) {
  return kind === "greenhouse" ? fetchGreenhouse(token, fetchImpl) : kind === "lever" ? fetchLever(token, fetchImpl) : fetchAshby(token, fetchImpl);
}

/** Company display name: feeds that don't name the company get a readable form of the token. */
export function prettifyToken(token: string): string {
  return token.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
