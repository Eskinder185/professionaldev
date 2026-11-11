import { expect, test, type Page, type Route } from "@playwright/test";
import { auditContrast, setTheme } from "./helpers/contrast";

/**
 * The three home-lab pages in the real built site. The home-lab API and the published portfolio files are
 * simulated with route handlers, so these prove the pages' behaviour (rendering, states, accessibility, privacy of
 * the token), not that a real API or model works. The API itself is tested separately against PostgreSQL.
 */

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const group = (extra: Record<string, unknown[]> = {}) => ({ project: [], lab: [], certification: [], experience: [], ...extra });
const item = (slug: string, relevance: number, extra: Record<string, unknown> = {}) => ({ slug, title: `Item ${slug}`, summary: `Summary for ${slug}.`, issuer: null, url: null, repo_url: null, started_on: null, ended_on: null, relevance, skills: [], ...extra });

const ROLES = { roles: [{ slug: "aws-datacenter", title: "AWS Data Center", description: "Infrastructure.", item_count: 2 }, { slug: "react-dev", title: "React Developer", description: null, item_count: 1 }] };
const AWS = { role: { slug: "aws-datacenter", title: "AWS Data Center", description: "Hands-on infrastructure work." }, groups: group({ lab: [item("vpc-lab", 5, { skills: ["Networking basics"] })], certification: [item("ccna", 3, { issuer: "Cisco" })] }), total: 2, generated_at: "2026-11-01T00:00:00+00:00" };
const REACT = { role: { slug: "react-dev", title: "React Developer", description: null }, groups: group({ project: [item("react-app", 5)] }), total: 1 };

async function stubPortfolio(page: Page) {
  await page.route("**/portfolio/index.json", (r) => json(r, ROLES));
  await page.route("**/portfolio/aws-datacenter.json", (r) => json(r, AWS));
  await page.route("**/portfolio/react-dev.json", (r) => json(r, REACT));
  await page.route("**/portfolio/all.json", (r) => json(r, { role: null, groups: group({ project: [item("react-app", 0)], lab: [item("vpc-lab", 0)] }), total: 2 }));
  await page.route("**/portfolio/nope.json", (r) => r.fulfill({ status: 404, body: "" }));
}

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

test.describe("Portfolio by role", () => {
  test("?role= shows only that role's items, highlights strong matches, and switching roles works", async ({ page }) => {
    await stubPortfolio(page);
    await page.goto("portfolio?role=aws-datacenter");
    await expect(page.getByRole("heading", { level: 1, name: "Highlighted for: AWS Data Center" })).toBeVisible();
    await expect(page.getByText("Hands-on infrastructure work.")).toBeVisible();
    await expect(page.getByTestId("portfolio-group-lab")).toContainText("Item vpc-lab");
    await expect(page.getByTestId("portfolio-group-lab")).toContainText("Strong match");
    await expect(page.getByTestId("portfolio-group-lab")).toContainText("Networking basics");
    await expect(page.getByTestId("portfolio-group-certification")).not.toContainText("Strong match");
    await expect(page.getByTestId("portfolio-group-project")).toHaveCount(0);
    await expect(page.getByTestId("portfolio-source")).toContainText("published snapshot");

    await page.getByRole("link", { name: /React Developer/ }).click();
    await expect(page).toHaveURL(/portfolio\?role=react-dev$/);
    await expect(page.getByRole("heading", { level: 1, name: "Highlighted for: React Developer" })).toBeVisible();
    await expect(page.getByTestId("portfolio-group-project")).toContainText("Item react-app");
    await expect(page.getByTestId("portfolio-group-lab")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /React Developer/ })).toHaveAttribute("aria-current", "page");
  });

  test("an unknown role is explained, with a way back", async ({ page }) => {
    await stubPortfolio(page);
    await page.goto("portfolio?role=nope");
    await expect(page.getByTestId("portfolio-error")).toContainText("No view for that role");
    await page.getByRole("link", { name: "See everything" }).click();
    await expect(page.getByTestId("portfolio-group-project")).toBeVisible();
  });

  test("an unsafe role value is refused without any request for it", async ({ page }) => {
    await stubPortfolio(page);
    const requested: string[] = [];
    page.on("request", (r) => r.resourceType() !== "document" && requested.push(r.url())); // the page address itself is not a data request
    await page.goto("portfolio?role=../../secret");
    await expect(page.getByTestId("portfolio-error")).toContainText("isn’t valid");
    expect(requested.some((u) => u.includes("secret"))).toBe(false);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`readable and responsive in ${theme} mode`, async ({ page }) => {
      await setTheme(page, theme);
      await stubPortfolio(page);
      await page.goto("portfolio?role=aws-datacenter");
      await expect(page.getByTestId("portfolio-group-lab")).toBeVisible();
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
      expect(await noHorizontalScroll(page)).toBe(true);
      const problems = await auditContrast(page, ".lab-page", { dark: theme === "dark" });
      expect(problems, JSON.stringify(problems.slice(0, 3))).toEqual([]);
    });
  }
});

/* ---------------- API-backed pages ---------------- */

const APPS = { items: [{ id: 1, title: "Cloud Support Engineer", company: { id: 1, name: "Acme" }, status: "Applied", last_activity_at: "2026-11-01T00:00:00Z" }], total: 1, limit: 100, offset: 0 };
const TOKEN = "e2e-secret-token-0123456789";

interface Seen {
  auth: Array<string | undefined>;
  urls: string[];
}

async function stubApi(page: Page, extra: (route: Route, path: string) => Promise<boolean> | boolean = () => false): Promise<Seen> {
  const seen: Seen = { auth: [], urls: [] };
  await page.route("**/careeros/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^.*\/careeros\/v1/, "");
    seen.urls.push(request.url());
    seen.auth.push(request.headers()["authorization"]);
    if (request.headers()["authorization"] !== `Bearer ${TOKEN}` && path !== "/health") return json(route, { error: { code: "unauthorized", message: "A valid bearer token is required." } }, 401);
    if (path === "/health") return json(route, { status: "ok", database: "ok" });
    if (path === "/applications") return json(route, APPS);
    if (await extra(route, path)) return;
    return json(route, { error: { code: "not_found", message: "Not found." } }, 404);
  });
  return seen;
}

async function connect(page: Page, token = TOKEN) {
  await page.getByTestId("lab-token").fill(token);
  await page.getByTestId("lab-connect-btn").click();
}

test.describe("Technical screen practice", () => {
  const turn = (index: number, skill: string) => ({ index, skill, scenario: `A ${skill} incident with evidence in the logs.`, question: `What do you check first for ${skill}?`, difficulty: 3 });
  const feedback = { score: 4, strengths: ["Went to the logs first"], gaps: ["No rollback plan"], next_step: "Practise rollbacks" };

  test("connect, start, answer, get feedback, finish; the token never appears in a URL", async ({ page }) => {
    const seen = await stubApi(page, async (route, path) => {
      const method = route.request().method();
      if (path === "/interview/sessions" && method === "POST") { await json(route, { id: 5, total: 2, model: "local-model", style: "cysa", next_turn: turn(0, "DNS") }, 201); return true; }
      if (path === "/interview/sessions/5/turns/0/answer") { await json(route, { feedback, feedback_note: null, good_answer_covers: ["Check the zone records"], finished: false, next_turn: turn(1, "AWS") }); return true; }
      if (path === "/interview/sessions/5/turns/1/answer") { await json(route, { feedback: { ...feedback, score: 2 }, feedback_note: null, good_answer_covers: [], finished: true, next_turn: null }); return true; }
      return false;
    });
    await page.goto("lab/interview");
    await expect(page.getByTestId("interview-start")).toHaveCount(0); // nothing until connected
    await connect(page);
    await expect(page.getByTestId("lab-status")).toHaveText("Connected");
    await page.getByTestId("interview-style").selectOption("cysa");
    await page.getByTestId("interview-start").click();
    await expect(page.getByTestId("interview-question")).toContainText("A DNS incident");
    await expect(page.getByTestId("interview-progress")).toContainText("Question 1 of 2 · local-model");
    await expect(page.getByRole("log", { name: "Interview conversation" })).toBeVisible();

    await page.getByTestId("interview-input").fill("I would check the zone records and resolver logs first.");
    await page.getByTestId("interview-input").press("Control+Enter");
    await expect(page.getByTestId("interview-feedback")).toContainText("Practise rollbacks");
    await expect(page.getByLabel("Score 4 out of 5")).toBeVisible();
    await expect(page.getByTestId("interview-question")).toHaveCount(2);

    await page.getByTestId("interview-input").fill("Check the security group and route table.");
    await page.getByTestId("interview-send").click();
    await expect(page.getByTestId("interview-summary")).toContainText("Average score 3.0/5");
    expect(seen.urls.every((u) => !u.includes(TOKEN))).toBe(true);
    expect(page.url()).not.toContain(TOKEN);
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(JSON.parse(stored).local).not.toMatchObject({ "pd:careeros:lab-api-token": expect.anything() }); // the token lives in this tab only
  });

  test("a wrong token is explained and nothing loads", async ({ page }) => {
    await stubApi(page);
    await page.goto("lab/interview");
    await connect(page, "wrong");
    await expect(page.getByTestId("lab-message")).toContainText("didn’t accept that token");
    await expect(page.getByTestId("interview-start")).toHaveCount(0);
  });

  test("the model being down keeps the typed answer and can be retried", async ({ page }) => {
    let tries = 0;
    await stubApi(page, async (route, path) => {
      if (path === "/interview/sessions" && route.request().method() === "POST") { await json(route, { id: 5, total: 1, model: null, style: "general", next_turn: turn(0, "DNS") }, 201); return true; }
      if (path.endsWith("/answer")) {
        tries += 1;
        if (tries === 1) await json(route, { error: { code: "http_error", message: "The model server could not be reached. Is it running?" } }, 503);
        else await json(route, { feedback, feedback_note: null, good_answer_covers: [], finished: true, next_turn: null });
        return true;
      }
      return false;
    });
    await page.goto("lab/interview");
    await connect(page);
    await page.getByTestId("interview-start").click();
    await page.getByTestId("interview-input").fill("My careful answer");
    await page.getByTestId("interview-send").click();
    await expect(page.getByTestId("interview-error")).toContainText("could not be reached");
    await expect(page.getByTestId("interview-input")).toHaveValue("My careful answer");
    await page.getByTestId("interview-send").click();
    await expect(page.getByTestId("interview-summary")).toBeVisible();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`readable and responsive in ${theme} mode`, async ({ page }) => {
      await setTheme(page, theme);
      await stubApi(page, async (route, path) => {
        if (path === "/interview/sessions" && route.request().method() === "POST") { await json(route, { id: 5, total: 2, model: "m", style: "general", next_turn: turn(0, "DNS") }, 201); return true; }
        if (path.endsWith("/answer")) { await json(route, { feedback, feedback_note: null, good_answer_covers: ["Check records"], finished: false, next_turn: turn(1, "AWS") }); return true; }
        return false;
      });
      await page.goto("lab/interview");
      await connect(page);
      await page.getByTestId("interview-start").click();
      await page.getByTestId("interview-input").fill("An answer");
      await page.getByTestId("interview-send").click();
      await expect(page.getByTestId("interview-feedback")).toBeVisible();
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
      expect(await noHorizontalScroll(page)).toBe(true);
      const problems = await auditContrast(page, ".lab-page", { dark: theme === "dark" });
      expect(problems, JSON.stringify(problems.slice(0, 3))).toEqual([]);
    });
  }
});

test.describe("Skill-gap radar", () => {
  const axes = [
    { term: "Linux", kind: "required", category: "Operating Systems", uncertain: false, has_rating: true, proficiency: 4, target: 4, meets_target: true },
    { term: "DNS", kind: "required", category: "Networking", uncertain: false, has_rating: true, proficiency: 2, target: 4, meets_target: false },
    { term: "AWS", kind: "required", category: "Cloud Platforms", uncertain: false, has_rating: false, proficiency: 0, target: 4, meets_target: false },
    { term: "Terraform", kind: "preferred", category: "DevOps & CI/CD", uncertain: false, has_rating: false, proficiency: 0, target: 3, meets_target: false },
  ];
  const fit = { application_id: 1, title: "Cloud Support Engineer", company: "Acme", axes, omitted: 0, summary: { required_total: 3, required_rated: 2, required_meeting_target: 1, unrated: ["AWS", "Terraform"] }, targets: { required: 4, preferred: 3 }, note: "Targets are an assumption (required = 4/5, preferred = 3/5); the posting does not state a level. Ratings are your own self-assessment." };
  const stub = (page: Page) => stubApi(page, async (route, path) => (path === "/applications/1/skill-fit" ? (await json(route, fit), true) : false));

  test("draws a real radar for the chosen job, with a summary and a table of the same numbers", async ({ page }) => {
    await stub(page);
    await page.goto("lab/skill-gap/1");
    await connect(page);
    await expect(page.getByTestId("skillgap-summary")).toContainText("You meet the target on 1 of 3 required skills");
    const chart = page.getByTestId("skillgap-chart");
    await expect(chart).toBeVisible();
    await expect(chart.locator(".recharts-radar")).toHaveCount(2); // target and you
    await expect(chart.locator(".recharts-polar-angle-axis-tick").first()).toBeVisible();
    await expect(chart).toHaveAttribute("aria-label", /Radar chart comparing your proficiency with the target on 4 skills/);
    const table = page.getByTestId("skillgap-table");
    await expect(table.getByRole("row", { name: /AWS.*Not rated.*Rate this skill/ })).toBeVisible();
    await expect(table.getByRole("row", { name: /DNS.*2\/5.*Below target/ })).toBeVisible();
    await expect(page.getByTestId("skillgap-note")).toContainText("assumption");
  });

  test("choosing an application from the list loads its comparison", async ({ page }) => {
    await stub(page);
    await page.goto("lab/skill-gap");
    await connect(page);
    await page.getByTestId("skillgap-application").selectOption("1");
    await expect(page).toHaveURL(/lab\/skill-gap\/1$/);
    await expect(page.getByTestId("skillgap-result")).toBeVisible();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`readable and responsive in ${theme} mode`, async ({ page }) => {
      await setTheme(page, theme);
      await stub(page);
      await page.goto("lab/skill-gap/1");
      await connect(page);
      await expect(page.getByTestId("skillgap-chart").locator(".recharts-radar")).toHaveCount(2);
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
      expect(await noHorizontalScroll(page)).toBe(true);
      const problems = await auditContrast(page, ".lab-page", { dark: theme === "dark" });
      expect(problems, JSON.stringify(problems.slice(0, 3))).toEqual([]);
    });
  }
});
