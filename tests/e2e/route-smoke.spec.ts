import { expect, test } from "@playwright/test";

/**
 * Every route renders without an uncaught exception or a console error. This is the cheap guard
 * against one agent's change breaking another agent's page (broken import, missing provider, bad
 * state shape). External-network noise is filtered out; anything else fails the test.
 */
const ROUTES = [
  "", "dashboard", "matches", "jobs", "autoapply", "autoapply/sandbox", "tracker", "applications", "documents",
  "resume", "interviews", "analytics", "settings", "coach", "academy", "about", "contact", "tech-career-hub",
  "career-tools", "career-tools/resume-grader", "career-tools/star", "career-tools/stories", "career-tools/behavioral",
  "career-tools/elevator", "career-tools/elevator-studio", "career-tools/portfolio", "career-tools/star-builder",
  "career-tools/interview-sim", "career-tools/linkedin", "career-tools/github", "career/star-tool", "career/portfolio-audit",
  "self-assessment", "self-assessment/strengths", "self-assessment/values", "self-assessment/interests",
  "self/strengths", "self/values", "self/interests",
  "resources", "resources/roadmaps", "resources/certs", "resources/trackers", "resources/productivity", "resources/job-sites", "resources/app-tracker",
];

// Requests to the internet are not part of what is under test (CI/offline machines fail them).
const EXTERNAL = /Failed to load resource|net::ERR_|fonts\.(googleapis|gstatic)|favicon|ERR_NAME_NOT_RESOLVED/i;

for (const route of ROUTES) {
  test(`route /${route || "(home)"} renders without errors`, async ({ page, isMobile }) => {
    test.skip(isMobile, "route health is viewport independent; run once on desktop");
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !EXTERNAL.test(m.text())) problems.push(`console.error: ${m.text()}`);
    });
    await page.goto(`./${route}`);
    await expect(page.locator("main, #root").first()).toBeVisible();
    await expect(page.getByText("Page not found")).toHaveCount(0);
    await page.waitForTimeout(400); // let lazy routes and effects settle
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
