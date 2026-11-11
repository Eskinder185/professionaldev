/**
 * Shared job schema (v2). Matches, Jobs, AutoApply and the tracker all read this one shape.
 * Nothing here is invented: every optional field is `null`/empty unless the source stated it.
 */

export type JobSourceKind = "manual" | "import" | "greenhouse" | "lever" | "ashby";
export type WorkArrangement = "remote" | "hybrid" | "onsite" | "unspecified";
export type EmploymentType = "full-time" | "part-time" | "contract" | "internship" | "temporary" | "unspecified";

export interface Salary {
  min: number | null;
  max: number | null;
  currency: string;
  /** Pay period when the posting states one. */
  period: "year" | "hour" | "month" | "week" | "day" | null;
  /** The text as published, for display. */
  text: string;
}

export interface JobPosting {
  id: string;
  source: JobSourceKind;
  /** Id of the board connection that supplied it (for refresh/removal). */
  boardId: string | null;
  externalId: string | null;
  title: string;
  company: string;
  location: string;
  workArrangement: WorkArrangement;
  employmentType: EmploymentType;
  category: string;
  salary: Salary | null;
  /** When the employer published/updated it, if the source says. Never defaults to "now". */
  postedAt: string | null;
  /** Employer-board postings come straight from the employer's own ATS feed. */
  verifiedSource: boolean;
  url: string;
  applyUrl: string;
  /** Plain-text full posting (HTML is stripped; never rendered as HTML). */
  description: string;
  about: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  skills: string[];
  addedAt: string;
}

export interface BoardConnection {
  id: string;
  kind: "greenhouse" | "lever" | "ashby";
  /** Board token / company slug as used in the employer's public job-board URL. */
  token: string;
  companyName: string;
  lastFetchedAt: string | null;
  lastError: string | null;
  count: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: JobFilters;
}

export interface JobFilters {
  query: string;
  location: string;
  employmentType: EmploymentType | "any";
  experience: "any" | "entry" | "mid" | "senior";
  category: string;
  salaryMin: number | null;
  arrangement: WorkArrangement | "any";
  postedWithinDays: number | null;
  savedOnly: boolean;
  sort: "relevance" | "newest";
}

export const emptyFilters = (): JobFilters => ({
  query: "",
  location: "",
  employmentType: "any",
  experience: "any",
  category: "",
  salaryMin: null,
  arrangement: "any",
  postedWithinDays: null,
  savedOnly: false,
  sort: "relevance",
});

export interface Feedback {
  /** Postings the user said "yes, more like this" / "no" about. */
  liked: string[];
  disliked: string[];
}

export interface MatchPrefs {
  arrangements: WorkArrangement[];
  locations: string;
  minSalary: number | null;
  /** Comma-separated words. Jobs containing an excluded word are hidden from For You. */
  include: string;
  exclude: string;
  experience: "any" | "entry" | "mid" | "senior";
}

export const emptyPrefs = (): MatchPrefs => ({ arrangements: [], locations: "", minSalary: null, include: "", exclude: "", experience: "any" });

export interface JobStoreState {
  version: 2;
  postings: Record<string, JobPosting>;
  saved: string[];
  dismissed: string[];
  boards: BoardConnection[];
  searches: SavedSearch[];
  feedback: Feedback;
  prefs: MatchPrefs;
  /** Listing ids the user added to the tracker, mapped to the tracker application id. */
  tracked: Record<string, string>;
}

export const JOB_STORE_KEY = "pd:careeros:jobs:v2";
export const LEGACY_JOBS_KEY = "pd:careeros:saved-jobs";
export const LEGACY_SEARCHES_KEY = "pd:careeros:job-searches";

export const emptyStore = (): JobStoreState => ({
  version: 2,
  postings: {},
  saved: [],
  dismissed: [],
  boards: [],
  searches: [],
  feedback: { liked: [], disliked: [] },
  prefs: emptyPrefs(),
  tracked: {},
});

/** Shape written by the previous manual-only Jobs page. */
export interface LegacyJob {
  id: string;
  title: string;
  company: string;
  location: string;
  arrangement: string;
  type: string;
  url: string;
  description: string;
  skills: string[];
  savedAt: string;
  source: "manual";
}

const ARRANGEMENT: Record<string, WorkArrangement> = {
  remote: "remote",
  hybrid: "hybrid",
  "on-site": "onsite",
  onsite: "onsite",
  "on site": "onsite",
};
const EMPLOYMENT: Record<string, EmploymentType> = {
  "full-time": "full-time",
  "full time": "full-time",
  fulltime: "full-time",
  "part-time": "part-time",
  "part time": "part-time",
  parttime: "part-time",
  contract: "contract",
  contractor: "contract",
  intern: "internship",
  internship: "internship",
  temporary: "temporary",
  temp: "temporary",
};

export const toArrangement = (v: string | null | undefined): WorkArrangement => ARRANGEMENT[(v ?? "").trim().toLowerCase()] ?? "unspecified";
export const toEmployment = (v: string | null | undefined): EmploymentType => EMPLOYMENT[(v ?? "").trim().toLowerCase()] ?? "unspecified";

/** Non-destructive: the legacy record is converted, never deleted. */
export function migrateLegacyJob(j: LegacyJob): JobPosting {
  return {
    id: j.id,
    source: "manual",
    boardId: null,
    externalId: null,
    title: j.title,
    company: j.company,
    location: j.location ?? "",
    workArrangement: toArrangement(j.arrangement),
    employmentType: toEmployment(j.type),
    category: "",
    salary: null,
    postedAt: null,
    verifiedSource: false,
    url: j.url ?? "",
    applyUrl: j.url ?? "",
    description: j.description ?? "",
    about: "",
    responsibilities: [],
    requirements: [],
    benefits: [],
    skills: Array.isArray(j.skills) ? j.skills : [],
    addedAt: j.savedAt || new Date(0).toISOString(),
  };
}

export const LABEL = {
  arrangement: { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", unspecified: "Work arrangement not stated" } as Record<WorkArrangement, string>,
  employment: { "full-time": "Full-time", "part-time": "Part-time", contract: "Contract", internship: "Internship", temporary: "Temporary", unspecified: "Type not stated" } as Record<EmploymentType, string>,
};

export function postingAge(postedAt: string | null, now = Date.now()): string | null {
  if (!postedAt) return null;
  const t = Date.parse(postedAt);
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((now - t) / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : months < 12 ? `${months} months ago` : "Over a year ago";
}
