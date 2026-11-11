import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ashbyBoard, greenhouseBoard, leverBoard } from "../fixtures/boards";

const SHOTS = path.resolve(process.cwd(), "docs/careeros-4/screenshots");
const CORS = { "access-control-allow-origin": "*" };

async function mockBoards(page: Page) {
  await page.route("https://boards-api.greenhouse.io/**", (r) => (r.request().url().includes("/boards/acme/jobs") ? r.fulfill({ json: greenhouseBoard, headers: CORS }) : r.fulfill({ status: 404, body: "{}", headers: CORS })));
  await page.route("https://api.lever.co/**", (r) => (r.request().url().includes("/postings/northwind") ? r.fulfill({ json: leverBoard, headers: CORS }) : r.fulfill({ status: 404, body: "{}", headers: CORS })));
  await page.route("https://api.ashbyhq.com/**", (r) => (r.request().url().includes("/job-board/globex") ? r.fulfill({ json: ashbyBoard, headers: CORS }) : r.fulfill({ status: 404, body: "{}", headers: CORS })));
}

async function connect(page: Page, token: string, kind = "greenhouse") {
  await page.getByTestId("btn-boards").click();
  await page.getByTestId("board-kind").selectOption(kind);
  await page.getByTestId("board-token").fill(token);
  await page.getByTestId("board-connect").click();
  await expect(page.getByTestId("board-list")).toContainText(kind);
  await page.getByRole("button", { name: "Done" }).click();
}

const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

test.describe("CareerOS 4.0 job workspace", () => {
  test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

  test("primary navigation reaches all five destinations and marks the active one", async ({ page, isMobile }) => {
    await page.goto("/professionaldev/dashboard");
    const nav = isMobile ? page.getByRole("navigation", { name: "Mobile navigation" }) : page.getByRole("navigation", { name: "Primary" });
    for (const [label, url] of [["Matches", /\/matches$/], ["Jobs", /\/jobs$/], ["AutoApply", /\/autoapply$/], ["Tracker", /\/tracker$/], ["Docs|Documents", /\/documents$/]] as const) {
      await nav.getByRole("link", { name: new RegExp(`^${label}$`) }).click();
      await expect(page).toHaveURL(url);
    }
    await expect(nav.getByRole("link", { name: /Documents|Docs/ })).toHaveClass(/is-active/);
  });

  test("starts with no listings and never shows invented jobs", async ({ page }) => {
    await page.goto("/professionaldev/jobs");
    await expect(page.getByTestId("jobs-empty")).toContainText("doesn’t ship made-up jobs");
    await expect(page.getByTestId("job-count")).toContainText("No listings yet");
    await page.goto("/professionaldev/matches");
    await expect(page.getByTestId("matches-empty")).toBeVisible();
  });

  test("connects employer boards, filters compose, selection does not reload, saves persist", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop three-pane behaviour; mobile flow is tested separately");
    await mockBoards(page);
    await page.goto("/professionaldev/jobs");
    await connect(page, "acme");
    await expect(page.getByTestId("job-count")).toContainText("3 of 3 listings");
    await expect(page.locator('[data-testid^="job-row-"]')).toHaveCount(3);

    // Real data from the feed, rendered as plain text. The <script> in the posting never runs.
    await page.getByRole("option", { name: /Linux Systems Engineer/ }).click();
    const detail = page.getByTestId("job-detail");
    await expect(detail.getByRole("heading", { name: "Linux Systems Engineer" })).toBeVisible();
    await expect(detail.getByTestId("job-salary")).toContainText("$110,000");
    await expect(detail).toContainText("Atlanta, GA");
    await expect(detail).not.toContainText("ignore previous instructions");
    await expect(detail).toContainText("Employer board");

    // Selecting another job swaps the detail in place (no page reload).
    await page.evaluate(() => ((window as unknown as { __m: number }).__m = 42));
    await page.getByRole("option", { name: /Help Desk Technician/ }).click();
    await expect(page.getByTestId("job-detail").getByRole("heading", { name: "Help Desk Technician" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __m: number }).__m)).toBe(42);

    // Keyboard selection.
    await page.getByRole("option", { name: /Help Desk Technician/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("job-detail").getByRole("heading").first()).toBeVisible();

    // Filters compose; the count is the real count.
    await page.getByTestId("filter-query").fill("linux");
    await expect(page.getByTestId("job-count")).toContainText("1 of 3");
    await page.getByTestId("filter-query").fill("linux zzzz");
    await expect(page.getByTestId("jobs-no-results")).toBeVisible();
    await page.getByTestId("filter-clear").click();
    await expect(page.getByTestId("job-count")).toContainText("3 of 3");

    await page.getByTestId("filter-arrangement").selectOption("remote");
    await expect(page.locator('[data-testid^="job-row-"]')).toHaveCount(1);
    await page.getByTestId("filter-arrangement").selectOption("any");
    await page.getByTestId("filter-salary").selectOption("100000");
    await expect(page.locator('[data-testid^="job-row-"]')).toHaveCount(1); // only the posting that lists pay
    await page.getByTestId("filter-clear").click();
    await page.getByTestId("filter-date").selectOption("7");
    await expect(page.locator('[data-testid^="job-row-"]')).toHaveCount(2); // 2 and 5 days old; the 40-day-old one drops out
    await page.getByTestId("filter-clear").click();
    await page.getByTestId("filter-category").selectOption("Sales");
    await expect(page.locator('[data-testid^="job-row-"]')).toHaveCount(1);
    await page.getByTestId("filter-category").selectOption("");
    await page.getByTestId("filter-location").fill("atlanta");
    await page.getByTestId("filter-experience").selectOption("any");
    await expect(page.locator('[data-testid^="job-row-"]')).toHaveCount(1);

    // Saved searches round-trip.
    page.once("dialog", (d) => void d.accept("Atlanta jobs"));
    await page.getByTestId("search-save").click();
    await page.getByTestId("filter-clear").click();
    await page.getByRole("button", { name: /^Atlanta jobs/ }).first().click();
    await expect(page.getByTestId("filter-location")).toHaveValue("atlanta");
    await page.getByTestId("filter-clear").click();

    // Sort newest puts the 2-day-old posting first.
    await page.getByTestId("filter-sort").selectOption("newest");
    await expect(page.locator('[data-testid^="job-row-"]').first()).toContainText("Linux Systems Engineer");

    // Bookmarks persist across reloads.
    await page.getByRole("button", { name: "Save Help Desk Technician" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Remove Help Desk Technician from saved" })).toBeVisible();
    await page.getByTestId("filter-saved").check();
    await expect(page.locator('[data-testid^="job-row-"]')).toHaveCount(1);
    await page.screenshot({ path: path.join(SHOTS, "jobs-desktop.png"), fullPage: false });
  });

  test("analysis is evidence-based, tailoring uses the master, and the job flows to tracker and AutoApply", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop flow");
    await mockBoards(page);
    await page.goto("/professionaldev/jobs");
    await connect(page, "acme");
    await page.getByRole("option", { name: /Linux Systems Engineer/ }).click();

    const side = page.getByTestId("analysis-sidebar");
    await expect(side.getByTestId("panel-glance")).toContainText("3+ years");
    await expect(side.getByTestId("panel-glance")).toContainText("Bachelor");
    await expect(side.getByTestId("panel-glance")).toContainText("Linux+");
    await expect(side.getByTestId("coverage")).toContainText(/\d+ of \d+/);
    await expect(side.getByTestId("panel-benefits")).toContainText("401(k)");
    await expect(side.getByTestId("panel-history")).toContainText("isn’t available");
    // No work-authorization line unless the posting states one.
    await expect(side.getByTestId("glance-auth")).toHaveCount(0);
    // Networking never invents contacts.
    await expect(side.getByTestId("panel-networking")).toContainText("doesn’t look up employees");

    // Every group is built from engine output with evidence.
    const groups = await side.locator('[data-testid^="group-"]').count();
    expect(groups).toBeGreaterThan(0);

    // Add to tracker (idempotent) in the existing tracker store.
    await page.getByTestId("btn-track-job").click();
    await expect(page.getByTestId("btn-track-job")).toHaveText("In tracker");
    const tracked = await page.evaluate(() => JSON.parse(localStorage.getItem("appTracker:items") ?? "[]") as Array<{ company: string; role: string; status: string; jobId?: string }>);
    expect(tracked.filter((a) => a.role === "Linux Systems Engineer")).toHaveLength(1);
    expect(tracked.find((a) => a.role === "Linux Systems Engineer")?.status).toBe("Saved");

    // Prepare in AutoApply: queue item carries the real posting text and no invented fields.
    await page.getByTestId("btn-prepare-autoapply").click();
    await expect(page).toHaveURL(/\/autoapply\?focus=/);
    const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("pd:careeros:autoapply-queue") ?? "[]") as Array<{ title: string; company: string; location: string; jobDescription: string; platform: string }>);
    const q = queue.find((i) => i.title === "Linux Systems Engineer");
    expect(q?.company).toBe("Acme Cloud");
    expect(q?.location).toBe("Atlanta, GA");
    expect(q?.jobDescription).toContain("Kubernetes");
    expect(q?.platform).toBe("greenhouse");
    // Still just one tracker record for that job.
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("appTracker:items") ?? "[]") as Array<{ role: string }>);
    expect(after.filter((a) => a.role === "Linux Systems Engineer")).toHaveLength(1);

    // Tailor résumé: separate draft, master untouched.
    await page.goto("/professionaldev/jobs");
    await page.getByRole("option", { name: /Linux Systems Engineer/ }).click();
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem("pd:careeros:resume-documents") ?? "[]") as Array<{ kind?: string }>);
    const masterBefore = JSON.stringify(before.find((v) => v.kind === "master"));
    await page.getByTestId("btn-tailor").click();
    await expect(page).toHaveURL(/\/resume\?tailorJob=/);
    await expect(page.getByText(/Started a tailored draft|Opened your existing tailored version/)).toBeVisible({ timeout: 15_000 });
    const docs = await page.evaluate(() => JSON.parse(localStorage.getItem("pd:careeros:resume-documents") ?? "[]") as Array<{ kind?: string; name: string; jobId?: string }>);
    expect(docs.some((v) => v.kind === "tailored" && v.jobId?.startsWith("greenhouse:acme:"))).toBe(true);
    expect(JSON.stringify(docs.find((v) => v.kind === "master"))).toBe(masterBefore);
  });

  test("AutoApply suggests saved jobs ranked by evidence and queues only what the user picks", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop flow");
    await mockBoards(page);
    await page.goto("/professionaldev/jobs");
    await connect(page, "acme");
    await page.getByRole("button", { name: "Save Linux Systems Engineer" }).click();
    await page.getByRole("button", { name: "Save Help Desk Technician" }).click();
    await page.goto("/professionaldev/autoapply");
    const box = page.getByTestId("suggested-jobs");
    await expect(box).toBeVisible();
    await expect(box).toContainText(/requirements supported/);
    await expect(box.locator("li")).toHaveCount(2);
    // Nothing is queued until the user picks one.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pd:careeros:autoapply-queue") ?? "[]").length)).toBe(0);
    await box.getByTestId("suggested-prepare-greenhouse:acme:1001").click();
    await expect(box.getByTestId("suggested-prepare-greenhouse:acme:1001")).toHaveText("In queue");
    const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("pd:careeros:autoapply-queue") ?? "[]") as Array<{ title: string; status: string }>);
    expect(queue).toHaveLength(1);
    expect(queue[0].title).toBe("Linux Systems Engineer");
    expect(queue[0].status).not.toBe("Submitted and verified");
    await expect(page.getByTestId("application-queue-table")).toContainText("Linux Systems Engineer");
  });

  test("Matches ranks real listings, explains why, and remembers feedback and preferences", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop flow");
    await mockBoards(page);
    await page.goto("/professionaldev/jobs");
    await connect(page, "acme");
    await connect(page, "northwind", "lever");
    await connect(page, "globex", "ashby");
    await expect(page.getByTestId("job-count")).toContainText("5 of 5");

    await page.goto("/professionaldev/matches");
    const cards = page.locator('[data-testid^="match-card-"]');
    await expect(cards).toHaveCount(5);
    await expect(page.getByTestId("why-match").first()).toBeVisible();
    await cards.first().getByRole("button", { name: /Show details/ }).click();
    await expect(cards.first()).toContainText(/About the job|Full posting|Requirements/);

    // Feedback persists.
    await page.getByTestId("feedback-yes").click();
    await expect(page.getByTestId("feedback-yes")).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByTestId("feedback-yes")).toHaveAttribute("aria-pressed", "true");

    // Preferences hide matching words and persist.
    await page.getByTestId("btn-match-prefs").click();
    await page.getByTestId("pref-exclude").fill("commission");
    await page.getByTestId("pref-save").click();
    await expect(cards).toHaveCount(4);
    await expect(page.getByText(/1 hidden by your preferences/)).toBeVisible();
    await page.reload();
    await expect(cards).toHaveCount(4);

    // Dismiss removes a card; feeds switch.
    const target = page.locator('[data-testid^="match-card-"]', { hasText: "Platform Engineer" });
    await target.locator("summary").click();
    await target.getByRole("button", { name: "Not interested" }).click();
    await expect(cards).toHaveCount(3);
    await expect(page.getByText("Platform Engineer")).toHaveCount(0);
    await page.getByTestId("feed-remote").click();
    await expect(cards).toHaveCount(2); // Help Desk Technician and Security Analyst are the remote postings
    await expect(cards.first()).toContainText("Remote");
    await page.getByTestId("feed-for-you").click();
    await page.screenshot({ path: path.join(SHOTS, "matches-desktop.png") });
  });

  test("board errors are shown honestly and old saved jobs migrate without being deleted", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop flow");
    await page.addInitScript(() => {
      if (!localStorage.getItem("pd:careeros:saved-jobs")) {
        localStorage.setItem("pd:careeros:saved-jobs", JSON.stringify([{ id: "legacy-1", title: "Field Technician", company: "Old Co", location: "Dallas, TX", arrangement: "On-site", type: "Full-time", url: "https://example.com/job", description: "Install and repair equipment. Requires a driver's license.", skills: ["Troubleshooting"], savedAt: "2025-01-02T00:00:00.000Z", source: "manual" }]));
      }
    });
    await mockBoards(page);
    await page.goto("/professionaldev/jobs");
    await expect(page.getByRole("option", { name: /Field Technician/ })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("pd:careeros:saved-jobs"))).toContain("legacy-1");
    await expect(page.getByTestId("job-detail")).toContainText("Added by you");

    await page.getByTestId("btn-boards").click();
    await page.getByTestId("board-token").fill("does-not-exist");
    await page.getByTestId("board-connect").click();
    await expect(page.getByTestId("board-error")).toContainText("not found");
    await page.getByTestId("board-token").fill("not a token!");
    await page.getByTestId("board-connect").click();
    await expect(page.getByTestId("board-error")).toBeVisible();
  });

  test("Documents: library, search, filters, upload, preview and safe destructive actions", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop flow");
    await page.goto("/professionaldev/autoapply"); // creates the Master Profile the same way the real flow does
    await expect(page.getByTestId("autoapply-page")).toBeVisible();
    await page.goto("/professionaldev/documents");
    await expect(page.getByTestId("tab-resumes")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("doc-new-tile")).toBeVisible();
    await expect(page.locator("article").first()).toBeVisible();

    // Upload a cover letter (txt), find it under Cover letters, and not under Résumés.
    await page.getByTestId("doc-new-tile").click();
    await page.getByTestId("add-upload-letter").click();
    await page.getByTestId("doc-file-input").setInputFiles({ name: "Acme letter.txt", mimeType: "text/plain", buffer: Buffer.from("Dear Acme team,\nI would like to apply for the Linux role.\nSincerely, Me") });
    await expect(page.getByTestId("tab-letters")).toHaveAttribute("aria-pressed", "true");
    const letterCard = page.locator("article", { hasText: "Acme letter" });
    await expect(letterCard).toBeVisible();
    await page.getByTestId("tab-resumes").click();
    await expect(page.locator("article", { hasText: "Acme letter" })).toHaveCount(0);
    await page.getByTestId("tab-letters").click();

    // Preview, rename, duplicate, favorite.
    await letterCard.getByRole("button", { name: /Preview/ }).click();
    await expect(page.getByTestId("doc-preview")).toContainText("Dear Acme team");
    await page.getByRole("button", { name: "Close" }).click();
    await letterCard.getByRole("button", { name: /More actions/ }).click();
    await page.getByRole("menuitem", { name: /Rename/ }).click();
    await page.getByTestId("rename-input").fill("Acme Linux letter");
    await page.getByTestId("rename-save").click();
    const renamed = page.locator("article", { hasText: "Acme Linux letter" });
    await expect(renamed).toBeVisible();
    await page.getByRole("button", { name: "More actions for Acme Linux letter", exact: true }).click();
    await page.getByRole("menuitem", { name: /Duplicate/ }).click();
    await expect(page.locator("article", { hasText: "Acme Linux letter (copy)" })).toBeVisible();
    await page.getByRole("button", { name: "More actions for Acme Linux letter", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Favorite/ }).click();
    await page.getByLabel("Favorites").check();
    await expect(page.locator("article", { hasText: "Acme Linux letter" })).toHaveCount(1);
    await page.getByLabel("Favorites").uncheck();

    // Search filters.
    await page.getByTestId("doc-search").fill("copy");
    await expect(page.locator("article")).toHaveCount(1);
    await page.getByTestId("doc-search").fill("");

    // Download text.
    await page.getByRole("button", { name: "More actions for Acme Linux letter", exact: true }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Download text" }).click()]);
    expect(download.suggestedFilename()).toBe("Acme_Linux_letter.txt");

    // Delete needs confirmation, and cancel keeps the document.
    const copy = page.locator("article", { hasText: "Acme Linux letter (copy)" });
    await copy.getByRole("button", { name: /More actions/ }).click();
    await page.getByRole("menuitem", { name: /Delete/ }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(copy).toBeVisible();
    await copy.getByRole("button", { name: /More actions/ }).click();
    await page.getByRole("menuitem", { name: /Delete/ }).click();
    await page.getByTestId("confirm-delete").click();
    await expect(copy).toHaveCount(0);

    // The Master Profile cannot be deleted; every résumé edits in Résumé Studio.
    await page.getByTestId("tab-resumes").click();
    const master = page.locator("article", { hasText: "Master Profile" }).first();
    await master.getByRole("button", { name: /More actions/ }).click();
    await expect(page.getByRole("menuitem", { name: /Delete/ })).toBeDisabled();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page).toHaveURL(/\/resume$/);

    // Cover-letter editor: edits autosave; AI is optional and absent here.
    await page.goto("/professionaldev/documents");
    await page.getByTestId("tab-letters").click();
    await page.locator("article", { hasText: "Acme Linux letter" }).getByRole("button", { name: /More actions/ }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByTestId("letter-editor")).toBeVisible();
    await page.getByTestId("letter-text").fill("Edited text");
    await expect(page.getByTestId("letter-saved")).toContainText("Saved");
    await expect(page.getByTestId("letter-editor")).toContainText("No AI connected");
    await page.screenshot({ path: path.join(SHOTS, "cover-letter-editor.png") });
  });

  test("every résumé version survives: nothing in the library is lost by these flows", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop flow");
    await page.goto("/professionaldev/autoapply");
    await expect(page.getByTestId("autoapply-page")).toBeVisible();
    await page.goto("/professionaldev/documents");
    const ids = await page.evaluate(() => (JSON.parse(localStorage.getItem("pd:careeros:resume-documents") ?? "[]") as Array<{ id: string }>).map((v) => v.id));
    expect(ids.length).toBeGreaterThan(0);
    await page.goto("/professionaldev/jobs");
    await page.goto("/professionaldev/matches");
    await page.goto("/professionaldev/documents");
    const again = await page.evaluate(() => (JSON.parse(localStorage.getItem("pd:careeros:resume-documents") ?? "[]") as Array<{ id: string }>).map((v) => v.id));
    for (const id of ids) expect(again).toContain(id);
  });
});

test.describe("responsive layouts", () => {
  test("mobile job flow: list → details → analysis with Back, scroll and filters preserved", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await mockBoards(page);
    await page.goto("/professionaldev/jobs");
    await connect(page, "acme");
    await page.getByTestId("filter-query").fill("e");
    const list = page.getByTestId("job-list").locator("xpath=..");
    await list.evaluate((el) => (el.scrollTop = 0));
    await page.getByRole("option", { name: /Linux Systems Engineer/ }).click();
    await expect(page.getByTestId("job-detail")).toBeVisible();
    await page.getByTestId("btn-open-analysis").click();
    await expect(page.getByTestId("analysis-sidebar")).toBeVisible();
    await page.getByRole("button", { name: "Back to job", exact: true }).click();
    await page.getByRole("button", { name: "Back to jobs" }).click();
    await expect(page.getByTestId("filter-query")).toHaveValue("e");
    await expect(page.getByRole("option", { name: /Linux Systems Engineer/ })).toBeVisible();
    expect(await noHScroll(page)).toBe(true);
    await expect(page.getByRole("heading", { name: "Jobs", level: 1 })).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, "jobs-375.png") });
  });

  for (const width of [375, 430, 768, 1024, 1440, 1920]) {
    test(`no horizontal scroll at ${width}px on Jobs, Matches and Documents`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockBoards(page);
      await page.goto("/professionaldev/jobs");
      await connect(page, "acme");
      for (const route of ["/professionaldev/jobs", "/professionaldev/matches", "/professionaldev/documents"]) {
        await page.goto(route);
        await expect(page.locator("h1").first()).toBeVisible();
        expect(await noHScroll(page), `${route} @ ${width}`).toBe(true);
      }
      await page.goto("/professionaldev/matches");
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS, `matches-${width}.png`) });
      await page.goto("/professionaldev/jobs");
      await expect(page.getByRole("heading", { name: "Jobs", level: 1 })).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS, `jobs-${width}.png`) });
      await page.goto("/professionaldev/documents");
      await expect(page.getByRole("heading", { name: "Documents", level: 1 })).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS, `documents-${width}.png`) });
    });
  }
});
