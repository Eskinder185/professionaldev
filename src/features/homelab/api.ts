/**
 * Client for the optional home-lab API (apps/careeros-api).
 *
 * The website works without it. These helpers only run on the pages that use it, and they turn every
 * failure into a plain sentence. The bearer token is typed by the person and held only in
 * sessionStorage (gone when the tab closes); it is never put in a URL or sent anywhere but the API.
 */

const BASE_KEY = "pd:careeros:lab-api-base";
const TOKEN_KEY = "pd:careeros:lab-api-token";
const PREFIX = "/careeros/v1";

const fromEnv = (): string => ((import.meta.env.VITE_CAREEROS_API_URL as string | undefined) ?? "").replace(/\/+$/, "");

function read(storage: "local" | "session", key: string): string {
  try {
    return (storage === "local" ? localStorage : sessionStorage).getItem(key) ?? "";
  } catch {
    return "";
  }
}
function write(storage: "local" | "session", key: string, value: string): void {
  try {
    const target = storage === "local" ? localStorage : sessionStorage;
    if (value) target.setItem(key, value);
    else target.removeItem(key);
  } catch {
    // Storage can be blocked; the value then lasts only for this page view.
  }
}

/** Where the API lives. Empty means "this site" (the dev server proxies /careeros to it). */
export const getApiBase = (): string => read("local", BASE_KEY) || fromEnv();
export const getToken = (): string => read("session", TOKEN_KEY);

/** Accepts only http(s) URLs without credentials, query or fragment. Returns "" or the cleaned base. */
export function parseApiBase(input: string): { ok: true; base: string } | { ok: false; message: string } {
  const value = input.trim();
  if (!value) return { ok: true, base: "" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: "That doesn’t look like a web address. Try something like http://127.0.0.1:8000." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, message: "The address must start with http:// or https://." };
  if (url.username || url.password) return { ok: false, message: "Don’t put a username or password in the address." };
  if (url.search || url.hash) return { ok: false, message: "Use just the address, without a ? or # part." };
  return { ok: true, base: `${url.origin}${url.pathname.replace(/\/+$/, "")}` };
}

export function saveConnection(base: string, token: string): void {
  write("local", BASE_KEY, base);
  write("session", TOKEN_KEY, token);
}
export const forgetToken = (): void => write("session", TOKEN_KEY, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: "unreachable" | "unauthorized" | "not_found" | "disabled" | "rate_limited" | "invalid" | "server",
    readonly status = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  /** Send the bearer token. Public endpoints must not. */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, { method = "GET", body, auth = true, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (!token) throw new ApiError("Enter your API token first.", "unauthorized");
    headers.Authorization = `Bearer ${token}`;
  }
  let response: Response;
  try {
    response = await fetch(`${getApiBase()}${PREFIX}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") throw error;
    throw new ApiError("Can’t reach your home-lab API. Check that it’s running and that the address below is right.", "unreachable");
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: treat as an unexpected reply below.
  }
  if (response.ok) {
    if (data === null) throw new ApiError("The API replied with something unexpected.", "server", response.status);
    return data as T;
  }
  const message = (data as { error?: { message?: string } } | null)?.error?.message;
  switch (response.status) {
    case 401:
      throw new ApiError("The API didn’t accept that token.", "unauthorized", 401);
    case 404:
      throw new ApiError(message ?? "Not found.", "not_found", 404);
    case 409:
    case 422:
      throw new ApiError(message ?? "That request wasn’t accepted.", "invalid", response.status);
    case 429:
      throw new ApiError("Too many requests. Wait a minute and try again.", "rate_limited", 429);
    case 502:
    case 503:
      throw new ApiError(message ?? "The model or database behind the API isn’t available right now.", "server", response.status);
    default:
      throw new ApiError(message ?? "The API ran into a problem.", "server", response.status);
  }
}

/* ---------------- types ---------------- */

export interface ApplicationSummary {
  id: number;
  title: string;
  company: { id: number; name: string };
  status: string;
  last_activity_at: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface PortfolioItem {
  slug: string;
  title: string;
  summary: string;
  issuer: string | null;
  url: string | null;
  repo_url: string | null;
  started_on: string | null;
  ended_on: string | null;
  relevance: number;
  skills: string[];
}
export type PortfolioType = "project" | "lab" | "certification" | "experience";
export interface PortfolioData {
  role: { slug: string; title: string; description: string | null } | null;
  groups: Record<PortfolioType, PortfolioItem[]>;
  total: number;
  generated_at?: string;
}
export interface RoleSummary {
  slug: string;
  title: string;
  description: string | null;
  item_count: number;
}

export interface SkillAxis {
  term: string;
  kind: "required" | "preferred";
  category: string | null;
  uncertain: boolean;
  has_rating: boolean;
  proficiency: number;
  target: number;
  meets_target: boolean;
}
export interface SkillFit {
  application_id: number;
  title: string;
  company: string;
  axes: SkillAxis[];
  omitted: number;
  summary: { required_total: number; required_rated: number; required_meeting_target: number; unrated: string[] };
  targets: { required: number; preferred: number };
  note: string;
}

export interface InterviewTurn {
  index: number;
  skill: string | null;
  scenario: string;
  question: string;
  difficulty: number;
}
export interface Feedback {
  score: number;
  strengths: string[];
  gaps: string[];
  next_step: string;
}
export interface SessionStarted {
  id: number;
  total: number;
  model: string | null;
  style: string;
  next_turn: InterviewTurn;
}
export interface AnswerResult {
  feedback: Feedback | null;
  feedback_note: string | null;
  good_answer_covers: string[];
  finished: boolean;
  next_turn: InterviewTurn | null;
}

/* ---------------- calls ---------------- */

export const checkHealth = (signal?: AbortSignal) => apiRequest<{ status: string; database: string }>("/health", { auth: false, signal });
export const listApplications = (signal?: AbortSignal) => apiRequest<Page<ApplicationSummary>>("/applications?limit=100", { signal });
export const getSkillFit = (id: number, signal?: AbortSignal) => apiRequest<SkillFit>(`/applications/${id}/skill-fit`, { signal });
export const startInterview = (body: { application_id: number; style: string; question_count: number }, signal?: AbortSignal) =>
  apiRequest<SessionStarted>("/interview/sessions", { method: "POST", body, signal });
export const answerTurn = (sessionId: number, index: number, answer: string, signal?: AbortSignal) =>
  apiRequest<AnswerResult>(`/interview/sessions/${sessionId}/turns/${index}/answer`, { method: "POST", body: { answer }, signal });

const SAFE_ROLE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The published portfolio for a role. Uses the live API only when an address was configured, and
 * otherwise (or if it fails) the static snapshot the site was built with, so the page keeps
 * working when the home lab is offline.
 */
export async function loadPortfolio(role: string | null, signal?: AbortSignal): Promise<{ data: PortfolioData; source: "live" | "snapshot" }> {
  if (role !== null && !SAFE_ROLE.test(role)) throw new ApiError("That role isn’t valid.", "invalid");
  if (getApiBase()) {
    try {
      const data = await apiRequest<PortfolioData>(`/public/portfolio${role ? `?role=${encodeURIComponent(role)}` : ""}`, { auth: false, signal });
      return { data, source: "live" };
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") throw error;
      if (error instanceof ApiError && error.kind === "not_found" && role) throw error;
      // Otherwise fall back to the snapshot below.
    }
  }
  const response = await fetch(`${import.meta.env.BASE_URL}portfolio/${role ?? "all"}.json`, { signal, headers: { Accept: "application/json" } }).catch((error) => {
    if ((error as { name?: string })?.name === "AbortError") throw error;
    return null;
  });
  if (!response || !response.ok) {
    if (response?.status === 404 && role) throw new ApiError("There’s no portfolio view for that role.", "not_found", 404);
    throw new ApiError("No portfolio has been published yet.", "disabled", response?.status ?? 0);
  }
  const data = (await response.json().catch(() => null)) as PortfolioData | null;
  if (!data || typeof data !== "object" || !data.groups) throw new ApiError("The published portfolio file isn’t readable.", "server");
  return { data, source: "snapshot" };
}

export async function loadRoles(signal?: AbortSignal): Promise<RoleSummary[]> {
  if (getApiBase()) {
    try {
      return (await apiRequest<{ roles: RoleSummary[] }>("/public/roles", { auth: false, signal })).roles;
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") throw error;
    }
  }
  const response = await fetch(`${import.meta.env.BASE_URL}portfolio/index.json`, { signal, headers: { Accept: "application/json" } }).catch(() => null);
  if (!response?.ok) return [];
  const data = (await response.json().catch(() => null)) as { roles?: RoleSummary[] } | null;
  return Array.isArray(data?.roles) ? data.roles : [];
}
