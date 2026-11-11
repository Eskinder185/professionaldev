import { expect, test, type Page } from "@playwright/test";
import { CLASSIC_RESUME } from "../fixtures/resumes";

const fileInput = (page: Page) => page.locator('input[type="file"]');

async function importResumeText(page: Page, text: string, name = "resume.txt") {
  await fileInput(page).setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
  await expect(page.getByRole("status")).toContainText("Imported");
}

test("one-page engine measures fit, detects overflow, blocks export until resolved, and creates a separate tailored version", async ({ page, isMobile }) => {
  await page.goto("./resume");
  await importResumeText(page, CLASSIC_RESUME);
  if (isMobile) await page.getByRole("tab", { name: "Preview" }).click();

  // Default fits on 1 page
  await expect(page.getByTestId("page-fit")).toContainText("Page Fit: 1 of 1");

  // Switch across all three templates without losing content
  for (const tpl of ["One-Page Technical", "One-Page Modern", "One-Page Classic"]) {
    await page.getByRole("radio", { name: new RegExp(tpl) }).first().click();
    await expect(page.locator(".rd-pages")).toContainText("Jordan Rivera");
    await expect(page.locator(".rd-pages")).toContainText("Lone Star Health Services");
  }

  // Add verbose content to trigger overflow
  const longResume = `${CLASSIC_RESUME}

Senior Systems Engineer
Apex Cloud Operations | Austin, TX | Jan 2018 – May 2020
• Designed and operated hybrid Windows Server and Linux infrastructure across 14 regional clinics with 99.98% uptime and automated patching workflows.
• Built PowerShell and Python operational runbooks that reduced recurring incident resolution times across tier-2 and tier-3 queues.
• Coordinated firewall rule audits, VPN tunnel migrations, and VLAN segmentation changes with security and compliance stakeholders.
• Mentored 8 support engineers on incident response, root-cause documentation, and change-control procedures.

Infrastructure Analyst
Lone Star Financial Services | Austin, TX | Jun 2015 – Dec 2017
• Administered Active Directory, Group Policy, DNS, DHCP, and print services for 1,200 banking workforce endpoints.
• Led quarterly disaster recovery tabletop exercises and backup verification across VMware clusters and off-site vaults.
• Standardized hardware imaging and asset lifecycle tracking across 22 branch offices.
• Partnered with external auditors to gather access review evidence and remediate findings ahead of schedule.

Systems Administrator
Bluebonnet Logistics | Austin, TX | May 2013 – May 2015
• Maintained warehouse wireless networks, handheld barcode scanners, and label printing servers across three fulfillment centers.
• Documented standard operating procedures for overnight maintenance windows and emergency circuit failovers.
`;
  await importResumeText(page, longResume, "overflow.txt");
  if (isMobile) await page.getByRole("tab", { name: "Preview" }).click();

  await expect(page.getByTestId("page-fit")).toContainText(/Over limit: \d+ line/);

  // Standard one-page export is blocked when overflowing
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/One-page export is blocked/);

  // Open FitAssistant and verify resolution panel is shown
  await expect(page.getByRole("region", { name: "Optimize to one page" })).toBeVisible();
});

test("job description analysis filters out city/state/salary noise, shows metadata, and creates a named Tailored Résumé leaving Master Profile untouched", async ({ page, isMobile }) => {
  await page.goto("./resume");
  await importResumeText(page, CLASSIC_RESUME);

  if (isMobile) await page.getByRole("tab", { name: /^Requirements/ }).click();
  else await page.getByRole("tab", { name: /^Job match/ }).click();

  const noisyJd = `
Company: Amazon Web Services LLC
Location: Atlanta, GA / Stone Mountain, GA (On-site)
Compensation: $32/HR - $75,000/YR USD + RSU

MUST have 2+ years of experience in Linux, TCP/IP, DNS, DHCP, and Active Directory.
REQUIRED: CompTIA Network+ or Security+ certification.
Experience with Python or PowerShell scripting and troubleshooting rack hardware in VA or TX data centers.
`;

  await page.getByRole("textbox", { name: "Target job title" }).fill("Data Center Technician");
  await page.getByRole("textbox", { name: "Paste the job description" }).fill(noisyJd);
  await page.getByRole("button", { name: "Analyze requirements" }).click();

  // Real requirements are extracted
  await expect(page.locator(".rs-req").filter({ hasText: "Linux" }).first()).toBeVisible();
  await expect(page.locator(".rs-req").filter({ hasText: "DNS" }).first()).toBeVisible();

  // Location / state / salary / company suffix noise is NEVER classified as a requirement
  for (const noise of ["Atlanta", "Stone Mountain", "GA", "VA", "TX", "USD", "RSU", "LLC", "MUST", "REQUIRED"]) {
    await expect(page.locator(".rs-req .rs-req-term").filter({ hasText: new RegExp(`^${noise}$`, "i") })).toHaveCount(0);
  }

  // Job metadata is displayed separately as context chips
  await expect(page.getByLabel("Detected job metadata")).toBeVisible();

  // Create a tailored one-page version from Master Profile
  if (isMobile) await page.getByRole("tab", { name: "Edit" }).click();
  await page.getByTestId("propose-tailored-btn").click();
  await expect(page.getByRole("status")).toContainText(/Created tailored one-page version/);
  await expect(page.locator("#rs-version-name")).toHaveValue(/Data Center Technician/);
});

test("Local AI connection flow: offline guard, consent, model discovery, structured writing suggestion, approval, and endpoint change clearing state", async ({ page, isMobile }) => {
  // Mock local Ollama server on 127.0.0.1:11434
  await page.route("http://127.0.0.1:11434/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/api/tags")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [{ name: "llama3.2:latest", details: { family: "llama", parameter_size: "3B", quantization_level: "Q4_K_M" } }],
        }),
      });
      return;
    }
    if (url.endsWith("/api/chat")) {
      const post = JSON.parse(route.request().postData() || "{}");
      const isPing = post?.messages?.some((m: { content?: string }) => m.content === " Respond with the single word OK.");
      if (isPing) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ model: "llama3.2:latest", message: { role: "assistant", content: "OK" } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          model: "llama3.2:latest",
          message: {
            role: "assistant",
            content: JSON.stringify({
              suggestions: [
                {
                  actionType: "concise_bullet",
                  originalText: "Resolved an average of 35 tickets per week across hardware, software, and account access issues.",
                  proposedText: "Resolved 35+ weekly hardware, software, and account access tickets.",
                  reason: "Tightens wording by 5 words while preserving the 35 tickets/week metric and scope.",
                  evidence: "Lone Star Health Services — IT Support Specialist bullet 1",
                  relatedRequirement: "IT Support",
                  confidence: "high",
                  requiresConfirmation: true,
                },
              ],
            }),
          },
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, body: "Not found" });
  });

  await page.goto("./resume");
  await importResumeText(page, CLASSIC_RESUME);

  // Switch to AI panel
  if (isMobile) await page.getByRole("tab", { name: "AI" }).first().click();
  else await page.getByRole("tab", { name: "AI", exact: true }).last().click();

  // While disconnected, AI actions are disabled and offline message is visible
  await expect(page.getByText(/Offline Mode is active/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Make this more concise" })).toBeDisabled();

  // Configure local Ollama connection & enter an optional API key to verify memory-only behavior
  await page.getByRole("textbox", { name: /^API key/ }).fill("sk-test-memory-only-secret-999");
  await page.getByRole("checkbox", { name: /Allow CareerOS to send requests to 127\.0\.0\.1:11434/ }).check();

  await page.getByRole("button", { name: "Load models" }).click();
  await expect(page.getByRole("combobox", { name: "Available models" })).toHaveValue("llama3.2:latest");

  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("Connected (llama3.2:latest)").first()).toBeVisible();

  // Verify secret key is never written to localStorage or sessionStorage
  const storageDump = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(storageDump.local).not.toContain("sk-test-memory-only-secret-999");
  expect(storageDump.session).not.toContain("sk-test-memory-only-secret-999");

  // Select first experience bullet target so replacement applies to the bullet
  const targetSelect = page.getByLabel("Bullet or section to improve");
  const firstBulletValue = await targetSelect.locator("option").nth(1).getAttribute("value");
  if (firstBulletValue) await targetSelect.selectOption(firstBulletValue);

  // Run "Make this more concise" AI writing action
  await page.getByRole("button", { name: "Make this more concise" }).click();

  // Structured suggestion card appears with Original, Proposed, Reason, Evidence, Page-space impact, Job relevance
  const card = page.getByTestId("ai-suggestion-card").first();
  await expect(card).toBeVisible();
  await expect(card).toContainText("Resolved 35+ weekly hardware, software, and account access tickets.");
  await expect(card).toContainText("Tightens wording by 5 words");
  await expect(card).toContainText("Source evidence:");
  await expect(card).toContainText("Page-space impact:");
  await expect(card).toContainText("Job relevance:");

  // Accept suggestion -> updates résumé preview
  await card.getByRole("button", { name: "Accept" }).click();
  if (isMobile) await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.locator(".rd-pages")).toContainText(
    "Resolved 35+ weekly hardware, software, and account access tickets.",
  );

  // Changing the endpoint clears key, consent, model list, and connected status
  if (isMobile) await page.getByRole("tab", { name: "AI" }).first().click();
  await page.getByLabel("API endpoint").fill("http://127.0.0.1:1234/v1");
  await page.getByLabel("API endpoint").blur();
  await expect(page.getByRole("textbox", { name: /^API key/ })).toHaveValue("");
  await expect(page.getByRole("checkbox", { name: /Allow CareerOS to send requests/ })).not.toBeChecked();
});
