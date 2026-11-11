import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, loadPortfolio, loadRoles, parseApiBase, saveConnection } from "../../../src/features/homelab/api";
import InterviewLabPage from "../../../src/features/homelab/InterviewLabPage";
import PortfolioPage from "../../../src/features/homelab/PortfolioPage";
import SkillGapPage, { describeFit, toRadarData } from "../../../src/features/homelab/SkillGapPage";

// Minimal stand-ins for user-event (not a dependency of this project).
const userEvent = {
  async type(el: HTMLElement, text: string) {
    fireEvent.change(el, { target: { value: (el as HTMLInputElement).value + text } });
  },
  async click(el: HTMLElement) {
    fireEvent.click(el);
  },
  async selectOptions(el: HTMLElement, value: string) {
    fireEvent.change(el, { target: { value } });
  },
};

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response> | undefined;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (status: number, message: string) => json({ error: { code: "x", message } }, status);

function mockFetch(...handlers: Handler[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      for (const h of handlers) {
        const r = await h(url, init);
        if (r) return r;
      }
      return err(404, "no handler");
    }),
  );
  return calls;
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const group = (extra: Partial<Record<string, unknown[]>> = {}) => ({ project: [], lab: [], certification: [], experience: [], ...extra });
const item = (slug: string, relevance = 3, extra: Record<string, unknown> = {}) => ({ slug, title: `Title ${slug}`, summary: `Summary ${slug}`, issuer: null, url: null, repo_url: null, started_on: null, ended_on: null, relevance, skills: [], ...extra });

describe("API address and token handling", () => {
  it("accepts only clean http(s) addresses", () => {
    expect(parseApiBase("")).toEqual({ ok: true, base: "" });
    expect(parseApiBase(" http://127.0.0.1:8000/ ")).toEqual({ ok: true, base: "http://127.0.0.1:8000" });
    expect(parseApiBase("https://lab.example.test/api/")).toEqual({ ok: true, base: "https://lab.example.test/api" });
    for (const bad of ["ftp://x.test", "not a url", "http://u:p@host", "http://host/?token=1", "http://host/#x"]) expect(parseApiBase(bad).ok).toBe(false);
  });

  it("sends the token only to private endpoints, never in the URL", async () => {
    saveConnection("http://127.0.0.1:8000", "secret-token");
    const calls = mockFetch(() => json({ ok: 1 }));
    await apiRequest("/applications");
    await apiRequest("/health", { auth: false });
    expect(calls[0].url).toBe("http://127.0.0.1:8000/careeros/v1/applications");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect((calls[1].init?.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(calls.every((c) => !c.url.includes("secret-token"))).toBe(true);
    expect(calls[0].init?.credentials).toBe("omit");
  });

  it("asks for a token instead of calling the API without one", async () => {
    const calls = mockFetch(() => json({}));
    await expect(apiRequest("/applications")).rejects.toMatchObject({ kind: "unauthorized" });
    expect(calls).toHaveLength(0);
  });

  it.each([
    [401, "unauthorized", /didn.t accept that token/],
    [404, "not_found", /nope/],
    [409, "invalid", /nope/],
    [429, "rate_limited", /Too many/],
    [503, "server", /nope/],
  ])("turns HTTP %i into a plain message", async (status, kind, message) => {
    saveConnection("", "t");
    mockFetch(() => err(status, "nope"));
    await expect(apiRequest("/x")).rejects.toMatchObject({ kind, message: expect.stringMatching(message) });
  });

  it("explains an unreachable server without technical detail", async () => {
    saveConnection("", "t");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const error = (await apiRequest("/x").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("unreachable");
    expect(error.message).not.toMatch(/TypeError|fetch/);
  });
});

describe("loading the portfolio", () => {
  it("uses the published snapshot when no API address is configured", async () => {
    const calls = mockFetch((url) => (url.endsWith("/portfolio/aws-datacenter.json") ? json({ role: { slug: "aws-datacenter", title: "AWS", description: null }, groups: group(), total: 0 }) : undefined));
    const { source } = await loadPortfolio("aws-datacenter");
    expect(source).toBe("snapshot");
    expect(calls[0].url).toMatch(/portfolio\/aws-datacenter\.json$/);
  });

  it("prefers the live API when configured, and falls back to the snapshot if it is down", async () => {
    saveConnection("http://127.0.0.1:8000", "");
    mockFetch(
      (url) => (url.includes("/careeros/v1/public/portfolio") ? err(503, "down") : undefined),
      (url) => (url.endsWith("/portfolio/all.json") ? json({ role: null, groups: group(), total: 0 }) : undefined),
    );
    expect((await loadPortfolio(null)).source).toBe("snapshot");
    mockFetch((url) => (url.includes("/careeros/v1/public/portfolio") ? json({ role: null, groups: group(), total: 0 }) : undefined));
    expect((await loadPortfolio(null)).source).toBe("live");
  });

  it("rejects an unsafe role before any request is made", async () => {
    const calls = mockFetch(() => json({}));
    await expect(loadPortfolio("../../etc/passwd")).rejects.toMatchObject({ kind: "invalid" });
    await expect(loadPortfolio("A B")).rejects.toMatchObject({ kind: "invalid" });
    expect(calls).toHaveLength(0);
  });

  it("an unknown role is reported as such rather than silently showing everything", async () => {
    mockFetch(() => new Response("", { status: 404 }));
    await expect(loadPortfolio("nope")).rejects.toMatchObject({ kind: "not_found" });
  });

  it("returns no roles when nothing is published", async () => {
    mockFetch(() => new Response("", { status: 404 }));
    expect(await loadRoles()).toEqual([]);
  });
});

function renderPortfolio(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/portfolio" element={<PortfolioPage />} /></Routes></MemoryRouter>);
}

describe("PortfolioPage", () => {
  const roles = { roles: [{ slug: "aws-datacenter", title: "AWS Data Center", description: null, item_count: 2 }, { slug: "react-dev", title: "React Developer", description: null, item_count: 1 }] };

  it("reads ?role= and shows only that role's groups, with strong matches called out", async () => {
    mockFetch(
      (url) => (url.endsWith("/portfolio/index.json") ? json(roles) : undefined),
      (url) =>
        url.endsWith("/portfolio/aws-datacenter.json")
          ? json({
              role: { slug: "aws-datacenter", title: "AWS Data Center", description: "Hands-on infrastructure work." },
              groups: group({ lab: [item("vpc-lab", 5, { skills: ["Networking basics"] })], certification: [item("ccna", 3, { issuer: "Cisco", started_on: "2024-05-01" })] }),
              total: 2,
              generated_at: "2026-11-01T00:00:00+00:00",
            })
          : undefined,
    );
    renderPortfolio("/portfolio?role=aws-datacenter");
    expect(await screen.findByRole("heading", { level: 1, name: /Highlighted for: AWS Data Center/ })).toBeInTheDocument();
    expect(screen.getByText("Hands-on infrastructure work.")).toBeInTheDocument();
    const labs = screen.getByTestId("portfolio-group-lab");
    expect(within(labs).getByText("Title vpc-lab")).toBeInTheDocument();
    expect(within(labs).getByText("Strong match")).toBeInTheDocument();
    expect(within(labs).getByText("Networking basics")).toBeInTheDocument();
    expect(within(screen.getByTestId("portfolio-group-certification")).queryByText("Strong match")).toBeNull(); // relevance 3
    expect(screen.queryByTestId("portfolio-group-project")).toBeNull(); // empty groups are not shown
    expect(screen.getByTestId("portfolio-source")).toHaveTextContent("2 items relevant to AWS Data Center · published snapshot");
    const nav = screen.getByRole("navigation", { name: "Choose a role" });
    expect(within(nav).getByRole("link", { name: /AWS Data Center/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /React Developer/ })).toHaveAttribute("href", "/portfolio?role=react-dev");
  });

  it("shows everything, without role emphasis, when no role is chosen", async () => {
    mockFetch(
      () => undefined,
      (url) => (url.endsWith("/portfolio/index.json") ? json(roles) : undefined),
      (url) => (url.endsWith("/portfolio/all.json") ? json({ role: null, groups: group({ project: [item("app", 0)] }), total: 1 }) : undefined),
    );
    renderPortfolio("/portfolio");
    expect(await screen.findByText("Title app")).toBeInTheDocument();
    expect(screen.queryByText("Strong match")).toBeNull();
  });

  it("explains an unknown role and offers a way back", async () => {
    mockFetch(() => new Response("", { status: 404 }));
    renderPortfolio("/portfolio?role=nope");
    expect(await screen.findByTestId("portfolio-error")).toHaveTextContent("No view for that role");
    expect(screen.getByRole("link", { name: "See everything" })).toHaveAttribute("href", "/portfolio");
  });

  it("says so when a role has nothing published", async () => {
    mockFetch((url) => (url.endsWith("/aws-datacenter.json") ? json({ role: { slug: "aws-datacenter", title: "AWS", description: null }, groups: group(), total: 0 }) : undefined));
    renderPortfolio("/portfolio?role=aws-datacenter");
    expect(await screen.findByTestId("portfolio-empty")).toBeInTheDocument();
  });

  it("opens links safely", async () => {
    mockFetch((url) => (url.endsWith("/all.json") ? json({ role: null, groups: group({ project: [item("app", 0, { url: "https://example.test/app" })] }), total: 1 }) : undefined));
    renderPortfolio("/portfolio");
    const link = await screen.findByRole("link", { name: /View/ });
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
  });
});

/* ---------------- skill-gap ---------------- */

const fit = (axes: unknown[], summary: Record<string, unknown> = {}) => ({
  application_id: 1,
  title: "Cloud Support Engineer",
  company: "Acme",
  axes,
  omitted: 0,
  summary: { required_total: 3, required_rated: 2, required_meeting_target: 1, unrated: ["AWS"], ...summary },
  targets: { required: 4, preferred: 3 },
  note: "Targets are an assumption (required = 4/5, preferred = 3/5); the posting does not state a level. Ratings are your own self-assessment.",
});
const axis = (term: string, kind: string, rated: boolean, proficiency: number, target = 4) => ({ term, kind, category: null, uncertain: false, has_rating: rated, proficiency, target, meets_target: rated && proficiency >= target });

describe("skill-gap data", () => {
  it("draws an unrated skill at zero but never calls it a measured score", () => {
    const data = toRadarData(fit([axis("Linux", "required", true, 4), axis("AWS", "required", false, 0)]) as never);
    expect(data).toEqual([
      { term: "Linux", target: 4, mine: 4, rated: true },
      { term: "AWS", target: 4, mine: 0, rated: false },
    ]);
  });

  it("describes the fit honestly, counting unrated required skills as not met", () => {
    expect(describeFit(fit([]) as never)).toBe("You meet the target on 1 of 3 required skills. 1 required skill isn’t rated yet, so they count as not met.");
    expect(describeFit(fit([], { required_rated: 3 }) as never)).toBe("You meet the target on 1 of 3 required skills.");
    expect(describeFit(fit([], { required_total: 0 }) as never)).toBe("This job has no required skills saved.");
  });
});

async function connectWith(token = "tok") {
  await userEvent.type(screen.getByTestId("lab-token"), token);
  await userEvent.click(screen.getByTestId("lab-connect-btn"));
}

const apps = { items: [{ id: 1, title: "Cloud Support Engineer", company: { id: 1, name: "Acme" }, status: "Applied", last_activity_at: "2026-11-01T00:00:00Z" }], total: 1, limit: 100, offset: 0 };
const basics: Handler[] = [(url) => (url.endsWith("/health") ? json({ status: "ok", database: "ok" }) : undefined), (url) => (url.includes("/applications?limit") ? json(apps) : undefined)];

describe("SkillGapPage", () => {
  const renderGap = (path = "/lab/skill-gap/1") =>
    render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/lab/skill-gap" element={<SkillGapPage />} /><Route path="/lab/skill-gap/:id" element={<SkillGapPage />} /></Routes></MemoryRouter>);

  it("shows a summary, an accessible chart, and a table with the same numbers", async () => {
    mockFetch(...basics, (url) => (url.endsWith("/applications/1/skill-fit") ? json(fit([axis("Linux", "required", true, 4), axis("DNS", "required", true, 2), axis("AWS", "required", false, 0), axis("Terraform", "preferred", false, 0, 3)])) : undefined));
    renderGap();
    await connectWith();
    expect(await screen.findByTestId("skillgap-summary")).toHaveTextContent("You meet the target on 1 of 3 required skills");
    expect(screen.getByTestId("skillgap-chart")).toHaveAttribute("aria-label", expect.stringContaining("Radar chart comparing your proficiency with the target on 4 skills"));
    const table = screen.getByTestId("skillgap-table");
    expect(within(table).getByRole("row", { name: /AWS Required 4\/5 Not rated Rate this skill/ })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Linux Required 4\/5 4\/5 Meets target/ })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /DNS Required 4\/5 2\/5 Below target/ })).toBeInTheDocument();
    expect(screen.getByTestId("skillgap-note")).toHaveTextContent("assumption");
  });

  it("falls back to the table when there are too few skills for a radar", async () => {
    mockFetch(...basics, (url) => (url.endsWith("/skill-fit") ? json(fit([axis("Linux", "required", true, 4), axis("DNS", "required", true, 2)])) : undefined));
    renderGap();
    await connectWith();
    expect(await screen.findByTestId("skillgap-too-few")).toBeInTheDocument();
    expect(screen.queryByTestId("skillgap-chart")).toBeNull();
    expect(screen.getByTestId("skillgap-table")).toBeInTheDocument();
  });

  it("explains a job with no saved requirements", async () => {
    mockFetch(...basics, (url) => (url.endsWith("/skill-fit") ? json(fit([], { required_total: 0 })) : undefined));
    renderGap();
    await connectWith();
    expect(await screen.findByTestId("skillgap-empty")).toHaveTextContent("No requirements saved");
  });

  it("reports a failed comparison in plain words", async () => {
    mockFetch(...basics, (url) => (url.endsWith("/skill-fit") ? err(404, "Application not found.") : undefined));
    renderGap();
    await connectWith();
    expect(await screen.findByTestId("skillgap-error")).toHaveTextContent("Application not found.");
  });

  it("a wrong token is explained and nothing else is loaded", async () => {
    const calls = mockFetch((url) => (url.endsWith("/health") ? json({ status: "ok", database: "ok" }) : undefined), () => err(401, "A valid bearer token is required."));
    renderGap();
    await connectWith("wrong");
    expect(await screen.findByTestId("lab-message")).toHaveTextContent("didn’t accept that token");
    expect(screen.queryByTestId("skillgap-application")).toBeNull();
    expect(calls.some((c) => c.url.includes("skill-fit"))).toBe(false);
  });

  it("choosing an application changes the address", async () => {
    mockFetch(...basics, (url) => (url.endsWith("/skill-fit") ? json(fit([])) : undefined));
    renderGap("/lab/skill-gap");
    await connectWith();
    const select = await screen.findByTestId("skillgap-application");
    fireEvent.change(select, { target: { value: "1" } });
    expect(await screen.findByTestId("skillgap-result")).toBeInTheDocument();
  });
});

/* ---------------- interview lab ---------------- */

const turn = (index: number, skill: string) => ({ index, skill, scenario: `Scenario for ${skill}: evidence goes here.`, question: `How do you handle ${skill}?`, difficulty: 3 });
const feedback = { score: 4, strengths: ["Found the cause"], gaps: ["No rollback plan"], next_step: "Practise rollbacks" };

describe("InterviewLabPage", () => {
  const renderLab = () => render(<MemoryRouter><InterviewLabPage /></MemoryRouter>);

  it("runs a whole session: start, answer with feedback, finish with a summary", async () => {
    const calls = mockFetch(
      ...basics,
      (url, init) => (url.endsWith("/interview/sessions") && init?.method === "POST" ? json({ id: 7, total: 2, model: "local-model", style: "aws", next_turn: turn(0, "DNS") }, 201) : undefined),
      (url) => (url.endsWith("/sessions/7/turns/0/answer") ? json({ feedback, feedback_note: null, good_answer_covers: ["Check records"], finished: false, next_turn: turn(1, "AWS") }) : undefined),
      (url) => (url.endsWith("/sessions/7/turns/1/answer") ? json({ feedback: { ...feedback, score: 2 }, feedback_note: null, good_answer_covers: [], finished: true, next_turn: null }) : undefined),
    );
    renderLab();
    await connectWith();
    await userEvent.selectOptions(await screen.findByTestId("interview-style"), "aws");
    await userEvent.click(screen.getByTestId("interview-start"));
    expect(await screen.findByTestId("interview-question")).toHaveTextContent("Scenario for DNS");
    expect(screen.getByTestId("interview-progress")).toHaveTextContent("Question 1 of 2 · local-model");
    expect(JSON.parse(String(calls.find((c) => c.url.endsWith("/interview/sessions"))!.init!.body))).toEqual({ application_id: 1, style: "aws", question_count: 5 });

    await userEvent.type(screen.getByTestId("interview-input"), "Check the records.");
    await userEvent.click(screen.getByTestId("interview-send"));
    const fb = await screen.findByTestId("interview-feedback");
    expect(fb).toHaveTextContent("What worked");
    expect(fb).toHaveTextContent("Practise rollbacks");
    expect(screen.getByLabelText("Score 4 out of 5")).toBeInTheDocument();
    expect(await screen.findAllByTestId("interview-question")).toHaveLength(2);
    expect(screen.getByTestId("interview-input")).toHaveValue("");

    await userEvent.type(screen.getByTestId("interview-input"), "Check the security group.");
    await userEvent.click(screen.getByTestId("interview-send"));
    const summary = await screen.findByTestId("interview-summary");
    expect(summary).toHaveTextContent("Average score 3.0/5 across 2 scored answers");
    expect(screen.queryByTestId("interview-input")).toBeNull();
  });

  it("keeps the typed answer when the model is unavailable, so it can be retried", async () => {
    let attempts = 0;
    mockFetch(
      ...basics,
      (url, init) => (url.endsWith("/interview/sessions") && init?.method === "POST" ? json({ id: 7, total: 1, model: null, style: "general", next_turn: turn(0, "DNS") }, 201) : undefined),
      (url) => {
        if (!url.endsWith("/sessions/7/turns/0/answer")) return undefined;
        attempts += 1;
        return attempts === 1 ? err(503, "The model server could not be reached. Is it running?") : json({ feedback, feedback_note: null, good_answer_covers: [], finished: true, next_turn: null });
      },
    );
    renderLab();
    await connectWith();
    await userEvent.click(await screen.findByTestId("interview-start"));
    await userEvent.type(await screen.findByTestId("interview-input"), "My careful answer");
    await userEvent.click(screen.getByTestId("interview-send"));
    expect(await screen.findByTestId("interview-error")).toHaveTextContent("could not be reached");
    expect(screen.getByTestId("interview-input")).toHaveValue("My careful answer");
    await userEvent.click(screen.getByTestId("interview-send"));
    expect(await screen.findByTestId("interview-summary")).toBeInTheDocument();
  });

  it("explains a start failure (for example an application with no saved skills)", async () => {
    mockFetch(...basics, (url, init) => (url.endsWith("/interview/sessions") && init?.method === "POST" ? err(409, "This application has no saved required or preferred skills yet. Save its requirements first.") : undefined));
    renderLab();
    await connectWith();
    await userEvent.click(await screen.findByTestId("interview-start"));
    expect(await screen.findByTestId("interview-error")).toHaveTextContent("no saved required or preferred skills");
    expect(screen.queryByTestId("interview-chat")).toBeNull();
  });

  it("shows a note instead of invented feedback when the model's feedback was unusable", async () => {
    mockFetch(
      ...basics,
      (url, init) => (url.endsWith("/interview/sessions") && init?.method === "POST" ? json({ id: 7, total: 1, model: "m", style: "general", next_turn: turn(0, "DNS") }, 201) : undefined),
      (url) => (url.endsWith("/answer") ? json({ feedback: null, feedback_note: "The model's feedback was not in a usable format, so none is shown. Your answer was saved.", good_answer_covers: [], finished: true, next_turn: null }) : undefined),
    );
    renderLab();
    await connectWith();
    await userEvent.click(await screen.findByTestId("interview-start"));
    await userEvent.type(await screen.findByTestId("interview-input"), "answer");
    await userEvent.click(screen.getByTestId("interview-send"));
    expect(await screen.findByTestId("interview-feedback")).toHaveTextContent("none is shown");
    expect(screen.getByTestId("interview-summary")).toHaveTextContent("No answers were scored");
  });

  it("states what the questions are and are not", async () => {
    mockFetch(...basics);
    renderLab();
    await connectWith();
    await waitFor(() => expect(screen.getByText(/not real exam questions/)).toBeInTheDocument());
  });
});
