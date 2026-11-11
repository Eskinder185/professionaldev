import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const ARTIFACT_DIR =
  "C:/Users/eskew/.gemini/antigravity/brain/27c5fd1d-749e-40f9-8ad0-d91b8882f1ab";

test.describe("CareerOS AutoApply — End-to-End & Extension Suite", () => {
  test("1. Unpacked Manifest V3 extension build artifacts, popup, sidepanel, and options UI work cleanly", async ({
    page,
  }) => {
    const distDir = path.resolve(process.cwd(), "apps/extension/dist");
    const manifestPath = path.join(distDir, "manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "storage", "sidePanel"]);
    expect(manifest.externally_connectable.matches).toContain(
      "https://eskinder185.github.io/professionaldev/*",
    );
    expect(fs.existsSync(path.join(distDir, "background.js"))).toBe(true);
    expect(fs.existsSync(path.join(distDir, "content.js"))).toBe(true);

    // Load popup UI and verify rendering & interaction
    const popupHtml = fs.readFileSync(path.join(distDir, "popup/index.html"), "utf8");
    const popupJs = fs.readFileSync(path.join(distDir, "popup/main.js"), "utf8");
    await page.setContent(
      popupHtml.replace('<script type="module" src="./main.js"></script>', `<script type="module">${popupJs}</script>`),
    );
    await expect(page.getByTestId("popup-platform-badge")).toBeVisible();
    await expect(page.getByTestId("popup-connection-status")).toBeVisible();
    await expect(page.getByTestId("btn-open-sidepanel")).toBeVisible();
    await expect(page.getByTestId("btn-open-careeros")).toBeVisible();
    await expect(page.getByTestId("btn-open-settings")).toBeVisible();

    // Side panel: bundle and stylesheet are built; full behaviour is covered by extension-sidepanel.spec.ts
    expect(fs.existsSync(path.join(distDir, "sidepanel/index.html"))).toBe(true);
    expect(fs.existsSync(path.join(distDir, "sidepanel/main.js"))).toBe(true);
    expect(fs.existsSync(path.join(distDir, "sidepanel/main.css"))).toBe(true);

    // Load Options UI and verify privacy disclosures, allowed domains, and Clear All Data
    const optHtml = fs.readFileSync(path.join(distDir, "options/index.html"), "utf8");
    const optJs = fs.readFileSync(path.join(distDir, "options/main.js"), "utf8");
    await page.setContent(
      optHtml.replace('<script type="module" src="./main.js"></script>', `<script type="module">${optJs}</script>`),
    );
    await expect(page.getByTestId("options-privacy-disclosures")).toContainText(
      "Never receives or stores AI API keys",
    );
    await page.getByTestId("opt-new-domain").fill("jobs.ashbyhq.com");
    await page.getByTestId("opt-btn-add-domain").click();
    await expect(page.getByTestId("opt-domains-list")).toContainText("jobs.ashbyhq.com");
    await page.getByTestId("opt-btn-clear-data").click();
    await expect(page.getByTestId("opt-clear-feedback")).toContainText(
      "All shared profile and queue data cleared",
    );
  });

  test("2. CareerOS AutoApply imports job links, skips duplicates, flags unsupported hosts, selects 1-page résumé, and drafts grounded answers", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 920 });
    await page.goto("/professionaldev/autoapply");

    await expect(page.getByTestId("autoapply-page")).toBeVisible();
    await expect(page.getByTestId("extension-handshake-badge")).toContainText("Practice mode");

    // Import batch with Greenhouse, Lever, duplicate Greenhouse, unsupported LinkedIn, and invalid protocol
    const batchUrls = [
      "https://boards.greenhouse.io/cascadecloud/jobs/4091821?title=Cloud_Infrastructure_Engineer&utm_source=test",
      "https://boards.greenhouse.io/cascadecloud/jobs/4091821?title=Cloud_Infrastructure_Engineer&fbclid=dup",
      "https://jobs.lever.co/northwindops/881920?title=Systems_Support_Engineer",
      "https://www.linkedin.com/jobs/view/99887766",
      "javascript:alert(1)",
    ].join("\n");

    await page.getByTestId("job-urls-input").fill(batchUrls);
    await page.getByTestId("btn-import-job-urls").click();

    // Verify batch report
    const report = page.getByTestId("import-batch-report");
    await expect(report).toBeVisible();
    await expect(report).toContainText("Imported: 3");
    await expect(page.getByTestId("import-duplicate-item")).toHaveCount(1);
    await expect(page.getByTestId("import-invalid-item")).toHaveCount(1);

    // Verify queue table has 3 items (Greenhouse, Lever, Unsupported LinkedIn)
    const table = page.getByTestId("application-queue-table");
    await expect(table).toContainText("Cascadecloud");
    await expect(table).toContainText("Northwindops");
    await expect(table).toContainText("Unsupported");

    // Paste job description and run requirement matching
    await page
      .getByTestId("detail-textarea-jd")
      .fill(
        "We are seeking a Cloud Infrastructure Engineer experienced with Linux, Ubuntu, Bash, Python, TCP/IP, DNS, DHCP, AWS, and hardware diagnostics.",
      );
    await page.getByTestId("btn-analyze-job").click();
    await expect(page.getByTestId("detail-match-score")).toContainText("Match Score:");

    // Verify One-Page Résumé Selection & Tailored One-Page creation
    await expect(page.getByTestId("selected-resume-page-fit")).toContainText("Page Fit: 1 of 1");
    await page.getByTestId("btn-create-tailored-resume").click();
    await expect(page.getByTestId("autoapply-sync-banner")).toContainText(
      "Created tailored one-page résumé",
    );
    await expect(page.getByTestId("selected-resume-page-fit")).toContainText("Page Fit: 1 of 1");

    // Verify Application Question Assistant grounded answers + Sensitive Question Guard
    await expect(page.getByTestId("question-card-motivation")).toBeVisible();
    await expect(page.getByTestId("question-card-troubleshooting")).toBeVisible();
    await expect(page.getByTestId("question-card-linux_systems")).toBeVisible();
    await expect(page.getByTestId("question-card-technical_problem")).toBeVisible();

    // Approve the Linux question answer
    await page.getByTestId("checkbox-approve-question-linux_systems").check();

    // Add a sensitive visa sponsorship question and verify the Sensitive Question Guard blocks auto-answering
    await page
      .getByTestId("input-custom-question")
      .fill("Will you now or in the future require visa sponsorship?");
    await page.getByTestId("btn-add-question").click();
    await expect(page.getByTestId("question-card-sensitive_manual")).toBeVisible();
    await expect(page.getByTestId("sensitive-question-warning")).toContainText(
      "Visa sponsorship",
    );

    if (fs.existsSync(ARTIFACT_DIR)) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "autoapply_dashboard_and_queue.png"),
        fullPage: true,
      });
    }
  });

  test("3. Synthetic Application Sandbox: inspects fields, autofills React-controlled inputs, protects sensitive EEO/visa fields, verifies user submission, and syncs back to CareerOS", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 920 });
    await page.goto("/professionaldev/autoapply");

    // Load sample batch and import
    await page.getByTestId("btn-load-sample-urls").click();
    await page.getByTestId("btn-import-job-urls").click();

    // Approve all 4 standard questions on the selected item
    await page.getByTestId("checkbox-approve-question-motivation").check();
    await page.getByTestId("checkbox-approve-question-troubleshooting").check();
    await page.getByTestId("checkbox-approve-question-linux_systems").check();
    await page.getByTestId("checkbox-approve-question-technical_problem").check();

    // Open the form in the Synthetic Application Sandbox
    await page.getByTestId("detail-btn-open-autofill").click();
    await expect(page.getByTestId("synthetic-application-page")).toBeVisible();

    // 1. Inspect Form
    await page.getByTestId("sandbox-btn-inspect").click();
    await expect(page.getByTestId("sandbox-detected-fields-panel")).toBeVisible();
    await expect(page.getByTestId("sandbox-stage-badge")).toContainText("fields_identified");

    // 2. Execute Autofill on Approved Fields
    await page.getByTestId("sandbox-btn-autofill").click();
    await expect(page.getByTestId("sandbox-copilot-message")).toContainText(
      "Autofill completed and verified in DOM",
    );

    // 3. Verify React-controlled inputs retained their autofilled values
    await expect(page.getByTestId("input-first-name")).toHaveValue("Alex");
    await expect(page.getByTestId("input-last-name")).toHaveValue("Rivera");
    await expect(page.getByTestId("input-email")).toHaveValue("alex.rivera@example.com");
    await expect(page.getByTestId("input-phone")).toHaveValue("(206) 555-0148");
    await expect(page.getByTestId("input-city")).toHaveValue("Seattle");
    await expect(page.getByTestId("input-state")).toHaveValue("WA");
    await expect(page.getByTestId("input-linkedin")).toHaveValue(
      "https://linkedin.com/in/alexrivera-sys",
    );
    await expect(page.getByTestId("input-github")).toHaveValue(
      "https://github.com/alexrivera-sys",
    );
    await expect(page.getByTestId("input-current-company")).toHaveValue("Cascade Cloud Systems");
    await expect(page.getByTestId("input-school")).toHaveValue("University of Washington");
    await expect(page.getByTestId("input-question-linux")).toContainText("Linux");

    // 4. Verify Sensitive / Legal / EEO fields were NEVER auto-answered
    await expect(page.getByTestId("input-work-authorization")).toHaveValue("");
    await expect(page.getByTestId("input-visa-sponsorship")).toHaveValue("");
    await expect(page.getByTestId("input-veteran-status")).toHaveValue("");
    await expect(page.getByTestId("input-salary-expectations")).toHaveValue("");

    if (fs.existsSync(ARTIFACT_DIR)) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "autoapply_sandbox_autofilled.png"),
        fullPage: true,
      });
    }

    // 5. Verify that clicking "Verify & Mark Submitted" BEFORE user submits does NOT mark as submitted
    await page.getByTestId("sandbox-btn-verify-submission").click();
    await expect(page.getByTestId("sandbox-copilot-message")).toContainText(
      "No submission confirmation banner detected yet",
    );

    // 6. User edits an answer and answers sensitive fields manually, then clicks Submit Application
    await page.getByTestId("input-work-authorization").selectOption("Yes");
    await page.getByTestId("input-visa-sponsorship").selectOption("No");
    await page.getByTestId("input-privacy-ack").check();
    await page.getByTestId("sandbox-btn-submit-application").click();

    // 7. Confirmation banner appears
    await expect(page.getByTestId("application-confirmation")).toBeVisible();
    await expect(page.getByTestId("application-confirmation")).toContainText(
      "Application submitted for",
    );

    // 8. Verify & Mark Submitted now succeeds and syncs back to CareerOS
    await page.getByTestId("sandbox-btn-verify-submission").click();
    await expect(page.getByTestId("sandbox-verified-tag")).toBeVisible();

    // 9. Return to CareerOS AutoApply page and verify status is "Submitted and verified"
    await page.getByTestId("sandbox-back-to-autoapply").click();
    await expect(page.getByTestId("metric-submitted-verified")).toHaveText("1");
    await expect(page.getByTestId("submission-history-table")).toContainText("Cascadecloud");

    // 10. Navigate to CareerOS Application Tracker (/applications) and verify it synced as "Applied"
    await page.getByTestId("link-to-applications-tracker").click();
    await expect(page.locator(".career-application-summary")).toContainText("1 Applied");
  });
});
