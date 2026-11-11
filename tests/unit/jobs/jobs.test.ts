import { beforeEach, describe, expect, it } from "vitest";
import { ConnectorError, fetchAshby, fetchGreenhouse, fetchLever, parseBoardInput } from "../../../src/features/jobs/connectors";
import { annualSalary, applyPrefs, filterAndSort } from "../../../src/features/jobs/filters";
import { emptyFilters, emptyPrefs, emptyStore, LEGACY_JOBS_KEY, migrateLegacyJob, postingAge, type JobPosting, type JobStoreState } from "../../../src/features/jobs/schema";
import { addPosting, applyBoardFetch, connectBoard, dismiss, loadJobStore, removeBoard, setFeedback, toggleSaved } from "../../../src/features/jobs/store";
import { detectArrangement, extractGlance, extractSalary, htmlToText, splitSections } from "../../../src/features/jobs/text";
import { MIN_FOR_RATES, moveApplication, pendingReviews, pipelineStats, type Application } from "../../../src/features/tracker/model";
import { ashbyBoard, greenhouseBoard, leverBoard } from "../../fixtures/boards";

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const mk = (over: Partial<JobPosting> = {}): JobPosting => ({
  id: "j1", source: "manual", boardId: null, externalId: null, title: "Linux Engineer", company: "Acme", location: "Atlanta, GA", workArrangement: "onsite",
  employmentType: "full-time", category: "Engineering", salary: null, postedAt: null, verifiedSource: false, url: "", applyUrl: "", description: "Linux and Bash.",
  about: "", responsibilities: [], requirements: [], benefits: [], skills: [], addedAt: "2026-01-01T00:00:00.000Z", ...over,
});
const state = (...p: JobPosting[]): JobStoreState => p.reduce((s, x) => addPosting(s, x, false), emptyStore());

describe("posting text is untrusted data", () => {
  it("strips scripts and markup and never keeps instructions as HTML", () => {
    const t = htmlToText("<p>Hello</p><script>alert(1)</script><ul><li>One</li><li>Two</li></ul><iframe src='x'></iframe>");
    expect(t).toContain("Hello");
    expect(t).toContain("• One");
    expect(t).not.toMatch(/alert|iframe|<script/i);
  });
  it("decodes entity-escaped HTML such as Greenhouse content", () => {
    expect(htmlToText("&lt;p&gt;Escaped &amp;amp; fine&lt;/p&gt;")).toContain("Escaped");
  });
  it("splits headings into sections and keeps unknown text under About", () => {
    const s = splitSections("Intro text\nResponsibilities\n• Do things\nRequirements:\n• 3 years\nBenefits\n• Dental");
    expect(s.about).toBe("Intro text");
    expect(s.responsibilities).toEqual(["Do things"]);
    expect(s.requirements).toEqual(["3 years"]);
    expect(s.benefits).toEqual(["Dental"]);
  });
  it("extracts salary only from explicit text", () => {
    expect(extractSalary("Pay range $110,000 - $140,000 per year")).toMatchObject({ min: 110000, max: 140000, period: "year" });
    expect(extractSalary("Competitive salary")).toBeNull();
    expect(extractSalary("We have 100 - 200 employees")).toBeNull();
  });
  it("detects work arrangement and glance facts only when stated", () => {
    expect(detectArrangement("Remote - US")).toBe("remote");
    expect(detectArrangement("Hybrid")).toBe("hybrid");
    expect(detectArrangement("Atlanta")).toBe("unspecified");
    const g = extractGlance({ title: "Systems Engineer", description: "3+ years of experience. Bachelor's degree in Computer Science. CompTIA Linux+ preferred. Must be authorized to work in the US.", requirements: [] });
    expect(g.experience).toMatch(/3\+ years/);
    expect(g.education).toMatch(/Bachelor/);
    expect(g.certifications).toContain("CompTIA Linux+");
    expect(g.workAuthorization).toMatch(/authorized to work/i);
    const none = extractGlance({ title: "Tech", description: "Fix computers.", requirements: [] });
    expect(none).toMatchObject({ experience: null, education: null, workAuthorization: null, certifications: [] });
  });
});

describe("employer board connectors", () => {
  it("maps Greenhouse, Lever and Ashby feeds without inventing data", async () => {
    const gh = await fetchGreenhouse("acme", () => json(greenhouseBoard));
    expect(gh.jobs).toHaveLength(3);
    expect(gh.jobs[0]).toMatchObject({ id: "greenhouse:acme:1001", company: "Acme Cloud", location: "Atlanta, GA", verifiedSource: true, category: "Engineering" });
    expect(gh.jobs[0].salary?.min).toBe(110000);
    expect(gh.jobs[0].description).not.toMatch(/alert\(/);
    expect(gh.jobs[1].salary).toBeNull();
    const lv = await fetchLever("northwind", () => json(leverBoard));
    expect(lv.jobs[0]).toMatchObject({ title: "Security Analyst I", workArrangement: "remote", employmentType: "full-time" });
    expect(lv.jobs[0].salary).toMatchObject({ min: 70000, max: 90000 });
    const ab = await fetchAshby("globex", () => json(ashbyBoard));
    expect(ab.jobs[0]).toMatchObject({ title: "Platform Engineer", employmentType: "full-time" });
    expect(ab.jobs[0].salary?.text).toContain("$150K");
  });
  it("reports real errors", async () => {
    await expect(fetchGreenhouse("nope", () => json({}, 404))).rejects.toThrow(/not found/);
    await expect(fetchGreenhouse("acme", () => json({ nope: 1 }))).rejects.toThrow(/unexpected/);
    await expect(fetchLever("acme", () => Promise.reject(new TypeError("fail")))).rejects.toThrow(ConnectorError);
    await expect(fetchLever("bad token!")).rejects.toThrow(/Invalid board token/);
  });
  it("accepts board URLs and rejects other hosts", () => {
    expect(parseBoardInput("https://boards.greenhouse.io/acme")).toEqual({ kind: "greenhouse", token: "acme" });
    expect(parseBoardInput("https://jobs.lever.co/northwind/abc")).toEqual({ kind: "lever", token: "northwind" });
    expect(parseBoardInput("https://jobs.ashbyhq.com/globex")).toEqual({ kind: "ashby", token: "globex" });
    expect(parseBoardInput("https://evil.example/acme")).toBeNull();
  });
});

describe("filters", () => {
  const jobs = [
    mk({ id: "a", title: "Linux Engineer", salary: { min: 110000, max: 140000, currency: "USD", period: "year", text: "" }, postedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), workArrangement: "remote" }),
    mk({ id: "b", title: "Help Desk", description: "Support users.", category: "IT", location: "Dallas, TX", salary: { min: 25, max: 30, currency: "USD", period: "hour", text: "" }, postedAt: new Date(Date.now() - 60 * 86_400_000).toISOString() }),
    mk({ id: "c", title: "Sales Rep", category: "Sales", description: "Commission sales." }),
  ];
  const run = (f: Partial<ReturnType<typeof emptyFilters>>) => filterAndSort(state(...jobs), { ...emptyFilters(), ...f }).map((p) => p.id).sort();
  it("composes and counts honestly", () => {
    expect(run({})).toEqual(["a", "b", "c"]);
    expect(run({ query: "linux" })).toEqual(["a"]);
    expect(run({ query: "linux bash" })).toEqual(["a"]);
    expect(run({ query: "linux zzz" })).toEqual([]);
    expect(run({ arrangement: "remote" })).toEqual(["a"]);
    expect(run({ category: "it" })).toEqual(["b"]);
    expect(run({ location: "dallas" })).toEqual(["b"]);
    expect(run({ query: "engineer", arrangement: "remote", location: "atlanta" })).toEqual(["a"]);
  });
  it("salary and date filters never guess", () => {
    expect(annualSalary(jobs[1])).toBe(30 * 2080); // hourly pay is annualised from the top of the range
    expect(run({ salaryMin: 100000 })).toEqual(["a"]);
    expect(run({ salaryMin: 50000 })).toEqual(["a", "b"]); // hourly pay is annualised; "c" lists none and is excluded
    expect(run({ postedWithinDays: 7 })).toEqual(["a"]); // undated "c" is excluded
    expect(run({ postedWithinDays: 90 })).toEqual(["a", "b"]);
  });
  it("hides dismissed and honours saved-only", () => {
    const s = toggleSaved(dismiss(state(...jobs), "c"), "a");
    expect(filterAndSort(s, emptyFilters()).map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(filterAndSort(s, { ...emptyFilters(), savedOnly: true }).map((p) => p.id)).toEqual(["a"]);
  });
  it("match preferences hide excluded words and report how many", () => {
    const r = applyPrefs(jobs, { ...emptyPrefs(), exclude: "commission" });
    expect(r.shown.map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(r.hidden).toBe(1);
  });
});

describe("store, migration and board refresh", () => {
  beforeEach(() => localStorage.clear());

  it("migrates the legacy library without deleting it", () => {
    localStorage.setItem(LEGACY_JOBS_KEY, JSON.stringify([{ id: "l1", title: "Tech", company: "Old", location: "TX", arrangement: "Remote", type: "Full-time", url: "https://x.y", description: "d", skills: ["Linux"], savedAt: "2025-01-01T00:00:00.000Z", source: "manual" }]));
    const s = loadJobStore();
    expect(s.postings.l1).toMatchObject({ workArrangement: "remote", employmentType: "full-time", skills: ["Linux"], source: "manual" });
    expect(s.saved).toContain("l1");
    expect(localStorage.getItem(LEGACY_JOBS_KEY)).toContain("l1");
    expect(migrateLegacyJob({ id: "z", title: "t", company: "c", location: "", arrangement: "Not specified", type: "Not specified", url: "", description: "", skills: [], savedAt: "", source: "manual" }).workArrangement).toBe("unspecified");
  });

  it("keeps saved listings when an employer removes them or the board is removed", async () => {
    const s0 = await connectBoard(emptyStore(), "greenhouse", "acme", () => json(greenhouseBoard));
    expect(Object.keys(s0.postings)).toHaveLength(3);
    expect(s0.postings["greenhouse:acme:1001"].company).toBe("Acme Cloud");
    const s1 = toggleSaved(s0, "greenhouse:acme:1001");
    const board = s1.boards[0];
    const s2 = applyBoardFetch(s1, board, []); // employer now lists nothing
    expect(Object.keys(s2.postings)).toEqual(["greenhouse:acme:1001"]);
    const s3 = removeBoard(s1, board.id);
    expect(Object.keys(s3.postings)).toEqual(["greenhouse:acme:1001"]);
    await expect(connectBoard(s0, "greenhouse", "acme", () => json(greenhouseBoard))).rejects.toThrow(/already connected/);
  });

  it("feedback is exclusive and reversible", () => {
    let s = setFeedback(emptyStore(), "x", "like");
    expect(s.feedback.liked).toEqual(["x"]);
    s = setFeedback(s, "x", "dislike");
    expect(s.feedback).toEqual({ liked: [], disliked: ["x"] });
    expect(setFeedback(s, "x", "clear").feedback).toEqual({ liked: [], disliked: [] });
  });

  it("never invents a posting date", () => {
    expect(postingAge(null)).toBeNull();
    expect(postingAge("not a date")).toBeNull();
  });
});

describe("tracker model", () => {
  const app = (over: Partial<Application>): Application => ({ id: Math.random().toString(36), company: "C", role: "R", status: "Applied", date: new Date().toISOString().slice(0, 10), ...over });

  it("status changes are logged and old records load unchanged", () => {
    const a = moveApplication(app({ status: "Saved", date: "" }), "Applied", new Date("2026-03-02T12:00:00Z"));
    expect(a.status).toBe("Applied");
    expect(a.date).toBe("2026-03-02");
    expect(a.history?.[0].event).toBe("Status changed from Saved to Applied");
    expect(moveApplication(a, "Applied")).toBe(a);
  });

  it("rates need enough data and activity only counts dated records", () => {
    const few = pipelineStats([app({}), app({ status: "Interview" })]);
    expect(few.interviewRate).toBeNull();
    expect(few.responseRate).toBeNull();
    const many = pipelineStats([...Array.from({ length: MIN_FOR_RATES }, () => app({})), app({ status: "Interview" }), app({ status: "Rejected" }), app({ status: "Saved" })]);
    expect(many.applied).toBe(MIN_FOR_RATES + 2);
    expect(many.interviewRate?.of).toBe(MIN_FOR_RATES + 2);
    expect(many.byStage.find((s) => s.stage === "Saved")?.count).toBe(1);
    expect(pipelineStats([app({ date: "" })]).weekly.every((w) => w.count === 0)).toBe(true);
  });

  it("pending reviews cite evidence and drop once handled", () => {
    const received = [{ queueId: "q1", company: "A", role: "R", url: "https://u/1", evidence: "e", receivedAt: "" }, { queueId: "q2", company: "B", role: "R", url: "https://u/2", evidence: "e", receivedAt: "" }];
    const base = { dismissed: [], confirmed: [], received };
    expect(pendingReviews(base, [])).toHaveLength(2);
    expect(pendingReviews({ ...base, dismissed: ["q1"] }, [])).toHaveLength(1);
    expect(pendingReviews(base, [app({ url: "https://u/2", status: "Applied" })]).map((r) => r.queueId)).toEqual(["q1"]);
    expect(pendingReviews(base, [app({ url: "https://u/2", status: "Saved" })])).toHaveLength(2);
  });
});
