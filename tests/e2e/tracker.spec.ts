import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const SHOTS = path.resolve(process.cwd(), "docs/careeros-4/screenshots");
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

type Seed = { id: string; company: string; role: string; status: string; date: string; location?: string };
const SEED: Seed[] = [
  { id: "a1", company: "Acme Cloud", role: "Linux Engineer", status: "Saved", date: iso(1), location: "Atlanta, GA" },
  { id: "a2", company: "Globex", role: "Platform Engineer", status: "Applied", date: iso(3) },
  { id: "a3", company: "Initech", role: "Help Desk Tech", status: "Applied", date: iso(9) },
  { id: "a4", company: "Umbrella", role: "SOC Analyst", status: "Interview", date: iso(12) },
  { id: "a5", company: "Hooli", role: "SRE", status: "Rejected", date: iso(20) },
  { id: "a6", company: "Stark", role: "IT Support", status: "Offer", date: iso(25) },
  { id: "a7", company: "Wayne", role: "Net Admin", status: "Applied", date: iso(30) },
];

async function seed(page: Page, items: Seed[] = SEED, extra: Record<string, string> = {}) {
  await page.addInitScript(({ items, extra }) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("appTracker:items", JSON.stringify(items));
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
      sessionStorage.setItem("seeded", "1");
    }
  }, { items, extra });
}
const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("appTracker:items") ?? "[]") as Array<{ id: string; status: string; history?: Array<{ event: string }>; archived?: boolean; interviews?: unknown[]; reminders?: unknown[]; notes?: string }>);

test.describe("tracker", () => {
  test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

  test("board shows the required columns, drag-and-drop changes status and persists", async ({ page, isMobile }) => {
    test.skip(isMobile, "drag and drop is a desktop interaction; the selects cover touch and keyboard");
    await seed(page);
    await page.goto("/professionaldev/tracker");
    for (const c of ["Saved", "Applied", "Interviewing", "Offer", "Rejected"]) await expect(page.getByRole("region", { name: `${c} column` })).toBeVisible();
    await expect(page.getByTestId("col-applied")).toContainText("Platform Engineer");
    await expect(page.getByTestId("col-interviewing")).toContainText("SOC Analyst");

    await page.getByTestId("card-a1").dragTo(page.getByTestId("col-applied"));
    await expect(page.getByTestId("col-applied")).toContainText("Linux Engineer");
    await expect(page.getByTestId("col-saved")).not.toContainText("Linux Engineer");
    await page.reload();
    await expect(page.getByTestId("col-applied")).toContainText("Linux Engineer");
    const a1 = (await stored(page)).find((a) => a.id === "a1");
    expect(a1?.status).toBe("Applied");
    expect(a1?.history?.some((h) => h.event.includes("from Saved to Applied"))).toBe(true);

    // Keyboard / assistive route: the status select on each card.
    const move = page.getByRole("combobox", { name: "Move Linux Engineer at Acme Cloud" });
    await move.focus();
    await move.selectOption("Screening");
    await expect(page.getByTestId("col-interviewing")).toContainText("Linux Engineer");
    await page.screenshot({ path: path.join(SHOTS, "tracker-board.png") });
  });

  test("list, board, timeline and chart read the same records", async ({ page }) => {
    await seed(page);
    await page.goto("/professionaldev/tracker");
    await page.getByRole("button", { name: "List" }).click();
    await expect(page.locator('[data-testid^="row-"]')).toHaveCount(7);
    await page.getByRole("combobox", { name: "Status for Platform Engineer" }).selectOption("Offer");

    // Sorting.
    await page.getByRole("button", { name: /^Company/ }).click();
    await expect(page.locator('[data-testid^="row-"]').first()).toContainText("Acme Cloud");
    await page.getByRole("button", { name: /^Company/ }).click();
    await expect(page.locator('[data-testid^="row-"]').first()).toContainText("Wayne");

    await page.getByRole("button", { name: "Board" }).click();
    await expect(page.getByTestId("col-offer")).toContainText("Platform Engineer");

    await page.getByRole("button", { name: "Chart" }).click();
    const stages = page.getByTestId("chart-stages");
    await expect(stages).toContainText("Offer");
    await expect(stages.locator("li", { hasText: "Offer" }).locator("strong")).toHaveText("2");
    await expect(stages.locator("li", { hasText: "Applied" }).locator("strong")).toHaveText("2");
    await expect(page.getByTestId("chart-weekly")).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, "tracker-chart.png") });

    await page.getByRole("button", { name: "Timeline" }).click();
    await expect(page.getByTestId("timeline")).toContainText("Platform Engineer at Globex");
  });

  test("rates are hidden when there is not enough data and shown when there is", async ({ page }) => {
    await seed(page, SEED.slice(0, 3));
    await page.goto("/professionaldev/tracker");
    await page.getByRole("button", { name: "Chart" }).click();
    await expect(page.getByTestId("interview-rate")).toContainText("Not enough data");
    await expect(page.getByTestId("response-rate")).toContainText("Not enough data");
    await page.evaluate((items) => localStorage.setItem("appTracker:items", JSON.stringify(items)), SEED);
    await page.reload();
    await page.getByRole("button", { name: "Chart" }).click();
    await expect(page.getByTestId("interview-rate")).toContainText("%");
    await expect(page.getByTestId("response-rate")).toContainText("of 6 applications");
  });

  test("application details: history, interviews, reminders, notes and documents persist", async ({ page }) => {
    await seed(page);
    await page.goto("/professionaldev/tracker");
    await page.getByRole("button", { name: "Open Platform Engineer at Globex" }).click();
    const d = page.getByTestId("application-detail");
    await expect(d).toContainText("Platform Engineer");
    await expect(d).toContainText("No saved posting is linked");
    await d.getByTestId("detail-status").selectOption("Screening");
    await expect(d.getByTestId("detail-history")).toContainText("from Applied to Screening");
    await d.getByTestId("iv-date").fill("2030-01-15T10:00");
    await d.getByTestId("iv-add").click();
    await expect(d).toContainText("2030-01-15 10:00");
    await d.getByTestId("rem-date").fill("2030-01-20");
    await d.getByTestId("rem-add").click();
    await expect(d).toContainText("2030-01-20");
    await d.getByTestId("detail-notes").fill("Recruiter is Sam");
    await d.getByTestId("detail-notes").blur();
    await page.getByRole("button", { name: "Close details" }).click();
    await page.reload();
    const rec = (await stored(page)).find((a) => a.id === "a2");
    expect(rec?.interviews).toHaveLength(1);
    expect(rec?.reminders).toHaveLength(1);
    expect(rec?.notes).toBe("Recruiter is Sam");
    await page.getByRole("button", { name: "List" }).click();
    await expect(page.locator('[data-testid="row-a2"]')).toContainText("Screening");
    await expect(page.locator('[data-testid="row-a2"]')).toContainText("2030-01-20"); // next action reflects the reminder
  });

  test("review banner shows only real records and never assumes a submission", async ({ page }) => {
    const review = { dismissed: [], confirmed: [], received: [
      { queueId: "q1", company: "Cascade Cloud", role: "Cloud Engineer", url: "https://boards.greenhouse.io/cascade/jobs/1", evidence: "AutoApply finished filling this application. CareerOS can’t tell whether you submitted it.", receivedAt: new Date().toISOString() },
      { queueId: "q2", company: "Northwind", role: "Support Engineer", url: "https://jobs.lever.co/northwind/2", evidence: "The application page showed: “Thanks for applying”", receivedAt: new Date().toISOString() },
    ] };
    await seed(page, [], { "pd:careeros:tracker-review": JSON.stringify(review) });
    await page.goto("/professionaldev/tracker");
    const banner = page.getByTestId("review-banner");
    await expect(banner).toContainText("Applications need review");
    await expect(banner).toContainText("2 applications");
    await page.getByTestId("btn-review").click();
    await expect(page.getByTestId("review-list")).toContainText("can’t tell whether you submitted");
    await expect(page.getByTestId("review-list")).toContainText("Thanks for applying");
    // Nothing was added to the tracker until the user confirms.
    expect(await stored(page)).toHaveLength(0);

    await page.getByTestId("confirm-q1").click();
    await expect(banner).toContainText("1 application");
    const after = await stored(page);
    expect(after).toHaveLength(1);
    expect(after[0].status).toBe("Applied");
    expect(after[0].history?.[0].event).toContain("You confirmed");

    await page.getByRole("button", { name: "I didn’t" }).click();
    await expect(banner).toHaveCount(0);
    expect(await stored(page)).toHaveLength(1); // dismissing adds nothing
    await page.reload();
    await expect(page.getByTestId("review-banner")).toHaveCount(0);
  });

  test("archive, filters, search and confirmed delete", async ({ page }) => {
    await seed(page);
    await page.goto("/professionaldev/tracker");
    await page.getByRole("button", { name: "Actions for SRE" }).click();
    await page.getByRole("menuitem", { name: /Archive/ }).click();
    await expect(page.getByTestId("card-a5")).toHaveCount(0);
    await page.getByTestId("scope-archived").click();
    await expect(page.getByTestId("card-a5")).toBeVisible();
    await page.getByTestId("scope-active").click();

    await page.getByTestId("tracker-search").fill("platform");
    await expect(page.locator('[data-testid^="card-"]')).toHaveCount(1);
    await page.getByTestId("tracker-search").fill("");
    await page.getByTestId("tracker-source").selectOption("board");
    await expect(page.getByTestId("tracker-none")).toBeVisible();
    await page.getByTestId("tracker-source").selectOption("mine");
    await expect(page.locator('[data-testid^="card-"]')).toHaveCount(6);

    await page.getByRole("button", { name: "Actions for Net Admin" }).click();
    await page.getByRole("menuitem", { name: /Delete/ }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("card-a7")).toBeVisible();
    await page.getByRole("button", { name: "Actions for Net Admin" }).click();
    await page.getByRole("menuitem", { name: /Delete/ }).click();
    await page.getByTestId("tracker-delete-yes").click();
    await expect(page.getByTestId("card-a7")).toHaveCount(0);
  });

  for (const width of [375, 430, 768, 1024, 1440, 1920]) {
    test(`tracker has no page-level horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await seed(page);
      await page.goto("/professionaldev/tracker");
      await expect(page.getByRole("heading", { name: "Application tracker" })).toBeVisible();
      for (const v of ["Board", "List", "Chart", "Timeline"]) {
        await page.getByRole("button", { name: v }).click();
        expect(await noHScroll(page), `${v} @ ${width}`).toBe(true);
      }
      await page.getByRole("button", { name: "Board" }).click();
      await page.screenshot({ path: path.join(SHOTS, `tracker-${width}.png`) });
    });
  }
});
