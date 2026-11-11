import { describe, expect, it, beforeEach } from "vitest";
import {
  importJobUrlBatch,
  validateAIQuestionDraftOutput,
  validateAndAnalyzeJobUrl,
  validateAutoApplyMessage,
  validateSenderOrigin,
  validateSharedProfileSubset,
} from "../../../packages/careeros-shared/schemas";
import {
  checkSensitiveField,
  discoverFormFields,
  executeFormAutofill,
  normalizeFieldValue,
  resolveSemanticField,
} from "../../../packages/careeros-shared/adapters";
import { handleExtensionMessage } from "../../../apps/extension/src/messaging/protocol";
import {
  getExtensionCapabilities,
  isAuthorizedCareerOSSender,
  isDomainAllowedForAutofill,
  SECURITY_DISCLOSURES,
} from "../../../apps/extension/src/security/permissions";
import { selectPlatformAdapter } from "../../../apps/extension/src/adapters";
import { clearExtensionState } from "../../../apps/extension/src/storage/stateStore";
import {
  analyzeAndPrepareQueueItem,
  buildSharedProfileSubset,
  checkResumeFitsOnePage,
  createTailoredOnePageResumeForQueueItem,
  DEFAULT_CONSENTED_FIELDS,
  ensureResumeVersions,
  importUrlsIntoQueue,
  loadApplicantProfile,
  syncQueueItemToApplicationTracker,
} from "../../../src/features/autoapply/storage";
import {
  buildDefaultQuestionSet,
  classifyQuestionCategory,
  draftGroundedAnswerDeterministic,
  generateQuestionDraftWithAI,
} from "../../../src/features/autoapply/questionAssistant";
import {
  exportAutoApplyBundleJson,
  importAutoApplyBundleJson,
} from "../../../src/features/autoapply/extensionBridge";

describe("CareerOS AutoApply — Unit Test Suite", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearExtensionState();
  });

  describe("1. URL Validation, Normalization & Security", () => {
    it("accepts valid HTTP/HTTPS job URLs and strips tracking parameters", () => {
      const res = validateAndAnalyzeJobUrl(
        "https://boards.greenhouse.io/cascadecloud/jobs/4091821?utm_source=linkedin&fbclid=abc123&title=Cloud_Engineer",
      );
      expect(res.ok).toBe(true);
      expect(res.platform).toBe("greenhouse");
      expect(res.supportLevel).toBe("supported");
      expect(res.companyHint).toBe("Cascadecloud");
      expect(res.jobIdHint).toBe("4091821");
      expect(res.normalizedUrl).toBe(
        "https://boards.greenhouse.io/cascadecloud/jobs/4091821?title=Cloud_Engineer",
      );
    });

    it("rejects non-HTTP/HTTPS protocols, embedded credentials, and unsafe open redirects", () => {
      expect(validateAndAnalyzeJobUrl("javascript:alert(1)").ok).toBe(false);
      expect(validateAndAnalyzeJobUrl("file:///etc/passwd").ok).toBe(false);
      expect(
        validateAndAnalyzeJobUrl("https://user:pass@boards.greenhouse.io/acme/jobs/1").ok,
      ).toBe(false);
      expect(
        validateAndAnalyzeJobUrl(
          "https://example.com/jobs/1?redirect_uri=https://evil.example.com/phish",
        ).ok,
      ).toBe(false);
    });
  });

  describe("2. Duplicate Detection & Batch Limits", () => {
    it("deduplicates identical normalized URLs and platform/company/jobId pairs", () => {
      const input = [
        "https://boards.greenhouse.io/acme/jobs/999?utm_source=test",
        "https://boards.greenhouse.io/acme/jobs/999?gclid=xyz",
        "https://jobs.lever.co/northwind/abc-123",
        "ftp://invalid.example.com/job",
      ].join("\n");

      const batch = importJobUrlBatch(input, [], 20);
      expect(batch.accepted).toHaveLength(2);
      expect(batch.duplicates).toHaveLength(1);
      expect(batch.invalid).toHaveLength(1);
    });

    it("enforces the per-batch URL limit of 20 links", () => {
      const urls = Array.from(
        { length: 22 },
        (_, i) => `https://boards.greenhouse.io/acme/jobs/${1000 + i}`,
      ).join("\n");
      const batch = importJobUrlBatch(urls, [], 20);
      expect(batch.accepted).toHaveLength(20);
      expect(batch.invalid).toHaveLength(2);
      expect(batch.invalid[0].error).toContain("Batch limit of 20 links");
    });
  });

  describe("3. Platform Detection & Adapter Selection", () => {
    it("identifies Greenhouse, Lever, Ashby, Workday, Generic, and Unsupported hosts", () => {
      expect(validateAndAnalyzeJobUrl("https://boards.greenhouse.io/stripe/jobs/123").platform).toBe(
        "greenhouse",
      );
      expect(validateAndAnalyzeJobUrl("https://jobs.lever.co/figma/456-abc").platform).toBe("lever");
      expect(validateAndAnalyzeJobUrl("https://jobs.ashbyhq.com/linear/789").platform).toBe("ashby");
      expect(
        validateAndAnalyzeJobUrl("https://amazon.myworkdayjobs.com/en-US/jobs/R-123").platform,
      ).toBe("workday");
      expect(
        validateAndAnalyzeJobUrl("https://www.linkedin.com/jobs/view/123456").platform,
      ).toBe("unsupported");
      expect(validateAndAnalyzeJobUrl("https://careers.acme.example.com/apply").platform).toBe(
        "generic",
      );
    });

    it("selects the matching runtime adapter for each platform", () => {
      expect(selectPlatformAdapter("https://boards.greenhouse.io/acme/jobs/1").id).toBe(
        "greenhouse",
      );
      expect(selectPlatformAdapter("https://jobs.lever.co/acme/1").id).toBe("lever");
      expect(selectPlatformAdapter("https://jobs.ashbyhq.com/acme/1").id).toBe("ashby");
      expect(selectPlatformAdapter("https://acme.myworkdayjobs.com/job/1").id).toBe("workday");
      expect(selectPlatformAdapter("https://www.linkedin.com/jobs/view/1").id).toBe("unsupported");
      expect(selectPlatformAdapter("https://careers.acme.com/apply").id).toBe("generic");
    });
  });

  describe("4. Field Classification, Sensitive Field Guard & Value Normalization", () => {
    it("classifies standard applicant fields with high confidence", () => {
      expect(resolveSemanticField({ label: "First Name *" }).mappedKey).toBe("firstName");
      expect(resolveSemanticField({ label: "Last Name *" }).mappedKey).toBe("lastName");
      expect(resolveSemanticField({ label: "Email Address" }).mappedKey).toBe("email");
      expect(resolveSemanticField({ label: "Phone Number" }).mappedKey).toBe("phone");
      expect(resolveSemanticField({ label: "LinkedIn Profile URL" }).mappedKey).toBe("linkedin");
      expect(resolveSemanticField({ label: "GitHub URL" }).mappedKey).toBe("github");
      expect(resolveSemanticField({ label: "Current Company" }).mappedKey).toBe("currentEmployer");
      expect(resolveSemanticField({ label: "University / School" }).mappedKey).toBe("school");
    });

    it("flags sensitive legal, EEO, work-authorization, visa, and salary fields as sensitive_manual", () => {
      expect(
        checkSensitiveField("Are you legally authorized to work in the United States?").isSensitive,
      ).toBe(true);
      expect(
        checkSensitiveField("Will you now or in the future require visa sponsorship?").isSensitive,
      ).toBe(true);
      expect(checkSensitiveField("Voluntary Self-Identification of Veteran Status").isSensitive).toBe(
        true,
      );
      expect(checkSensitiveField("Desired Salary Expectations").isSensitive).toBe(true);
      expect(checkSensitiveField("Do you have an active security clearance?").isSensitive).toBe(
        true,
      );
      expect(
        resolveSemanticField({ label: "Will you require visa sponsorship?" }).confidence,
      ).toBe("sensitive_manual");
    });

    it("normalizes phone numbers, URLs, and select options accurately", () => {
      expect(normalizeFieldValue("phone", "2065550148")).toBe("(206) 555-0148");
      expect(normalizeFieldValue("linkedin", "linkedin.com/in/alexrivera")).toBe(
        "https://linkedin.com/in/alexrivera",
      );
      expect(
        normalizeFieldValue("country", "US", ["Canada", "United States", "United Kingdom"]),
      ).toBe("United States");
    });
  });

  describe("5. Profile Mapping & Field-Level Consent Enforcement", () => {
    it("shares only explicitly consented fields and blocks unconsented fields or API keys", () => {
      const profile = loadApplicantProfile();
      const subset = buildSharedProfileSubset(profile, ["firstName", "email"]);
      expect(subset.sharedFields).toEqual(["firstName", "email"]);
      expect(subset.values.firstName).toBe(profile.firstName);
      expect(subset.values.email).toBe(profile.email);
      expect(subset.values.phone).toBeUndefined();

      const validCheck = validateSharedProfileSubset(subset);
      expect(validCheck.ok).toBe(true);

      // Attempting to smuggle an unconsented field fails validation
      const tampered = {
        ...subset,
        values: { ...subset.values, phone: "(206) 555-0148" },
      };
      expect(validateSharedProfileSubset(tampered).ok).toBe(false);

      // Attempting to smuggle an API key fails validation
      const withKey = {
        ...subset,
        values: { ...subset.values, firstName: "sk-1234567890abcdefghijklmnop" },
      };
      expect(validateSharedProfileSubset(withKey).ok).toBe(false);
    });
  });

  describe("6. Origin Validation, Permission Checks & Protocol State Machine", () => {
    it("validates authorized CareerOS production and localhost origins and rejects others", () => {
      expect(
        validateSenderOrigin("https://eskinder185.github.io/professionaldev/autoapply").ok,
      ).toBe(true);
      expect(
        validateSenderOrigin("http://localhost:5173/professionaldev/autoapply").ok,
      ).toBe(true);
      expect(
        validateSenderOrigin("http://127.0.0.1:4173/professionaldev/autoapply").ok,
      ).toBe(true);
      expect(validateSenderOrigin("https://evil.example.com/professionaldev/autoapply").ok).toBe(
        false,
      );
      expect(validateSenderOrigin("https://eskinder185.github.io/other-repo/").ok).toBe(false);
      expect(isAuthorizedCareerOSSender("").ok).toBe(false);
    });

    it("exposes minimal extension permissions and checks allowed domains", () => {
      const caps = getExtensionCapabilities();
      expect(caps.protocolVersion).toBe("1.0");
      expect(SECURITY_DISCLOSURES.minimalPermissions).toEqual([
        "activeTab",
        "scripting",
        "storage",
        "sidePanel",
      ]);
      expect(
        isDomainAllowedForAutofill("https://boards.greenhouse.io/acme/jobs/1", [
          "boards.greenhouse.io",
        ]),
      ).toBe(true);
      expect(
        isDomainAllowedForAutofill("https://untrusted.example.com/apply", ["boards.greenhouse.io"]),
      ).toBe(false);
    });

    it("prevents marking an application as Submitted and verified without confirmationVerified: true", () => {
      const badMsg = {
        protocol: "careeros-autoapply",
        version: "1.0",
        requestId: "req-12345",
        action: "UPDATE_APPLICATION_STATUS",
        origin: "https://eskinder185.github.io/professionaldev/autoapply",
        timestamp: new Date().toISOString(),
        payload: {
          applicationId: "app-1",
          status: "Submitted and verified",
          confirmationVerified: false,
        },
      };
      const check = validateAutoApplyMessage(badMsg);
      expect(check.ok).toBe(false);
      expect(check.error).toContain("confirmationVerified: true");

      const goodMsg = {
        ...badMsg,
        payload: {
          applicationId: "app-1",
          status: "Submitted and verified",
          confirmationVerified: true,
        },
      };
      expect(validateAutoApplyMessage(goodMsg).ok).toBe(true);
    });

    it("routes HANDSHAKE, TRANSFER_PROFILE, IMPORT_QUEUE, and CLEAR_SHARED_DATA through handleExtensionMessage", async () => {
      const senderUrl = "http://localhost:5173/professionaldev/autoapply";
      const handshakeRes = await handleExtensionMessage(
        {
          protocol: "careeros-autoapply",
          version: "1.0",
          requestId: "req-hs-1",
          action: "HANDSHAKE",
          origin: senderUrl,
          timestamp: new Date().toISOString(),
          payload: {},
        },
        { url: senderUrl },
      );
      expect(handshakeRes.ok).toBe(true);

      const profile = loadApplicantProfile();
      const subset = buildSharedProfileSubset(profile, DEFAULT_CONSENTED_FIELDS);
      const transferRes = await handleExtensionMessage(
        {
          protocol: "careeros-autoapply",
          version: "1.0",
          requestId: "req-tp-1",
          action: "TRANSFER_PROFILE",
          origin: senderUrl,
          timestamp: new Date().toISOString(),
          payload: subset,
        },
        { url: senderUrl },
      );
      expect(transferRes.ok).toBe(true);

      const clearRes = await handleExtensionMessage(
        {
          protocol: "careeros-autoapply",
          version: "1.0",
          requestId: "req-clr-1",
          action: "CLEAR_SHARED_DATA",
          origin: senderUrl,
          timestamp: new Date().toISOString(),
          payload: {},
        },
        { url: senderUrl },
      );
      expect(clearRes.ok).toBe(true);
    });
  });

  describe("7. AI Output Validation & Grounded Question Assistant", () => {
    it("accepts grounded AI JSON responses and rejects fabricated numbers or script injection", () => {
      const corpus =
        "Resolved 45+ weekly Linux tickets across 300+ production nodes with 99.95% SLA.";

      const validJson = JSON.stringify({
        answer:
          "I resolved 45+ weekly Linux tickets across 300+ production nodes while maintaining 99.95% SLA.",
        evidence: "Cascade Cloud Systems",
        requiresUserInput: false,
      });
      expect(validateAIQuestionDraftOutput(validJson, corpus).ok).toBe(true);

      const fabricatedMetricJson = JSON.stringify({
        answer: "I managed 5000 servers and saved 85% cost.",
        evidence: "Invented",
        requiresUserInput: false,
      });
      const fabCheck = validateAIQuestionDraftOutput(fabricatedMetricJson, corpus);
      expect(fabCheck.ok).toBe(false);
      expect(fabCheck.error).toContain("unverified number");

      const xssJson = JSON.stringify({
        answer: "<script>fetch('https://evil.com')</script>",
        evidence: "XSS",
      });
      expect(validateAIQuestionDraftOutput(xssJson, corpus).ok).toBe(false);
    });

    it("drafts grounded answers for standard questions and refuses to auto-answer sensitive questions", async () => {
      const profile = loadApplicantProfile();
      const defaults = buildDefaultQuestionSet(profile, {
        company: "Cascade Cloud",
        title: "Linux Engineer",
      });
      expect(defaults).toHaveLength(4);
      expect(defaults.every((d) => d.draftAnswer.length > 15 && !d.approved)).toBe(true);

      const sensitiveDraft = draftGroundedAnswerDeterministic(
        "Will you now or in the future require visa sponsorship?",
        profile,
      );
      expect(sensitiveDraft.category).toBe("sensitive_manual");
      expect(sensitiveDraft.requiresDirectUserInput).toBe(true);
      expect(sensitiveDraft.draftAnswer).toBe("");

      const aiDraft = await generateQuestionDraftWithAI(
        "What experience do you have with Linux?",
        profile,
        { company: "Cascade", title: "Engineer", jobDescription: "Linux" },
        async () =>
          JSON.stringify({
            answer:
              "I diagnosed and resolved 45+ weekly Linux tickets across 300+ production nodes.",
            evidence: "Cascade Cloud Systems",
            requiresUserInput: false,
          }),
      );
      expect(aiDraft.draftAnswer).toContain("45+ weekly Linux tickets");
      expect(classifyQuestionCategory("Describe your troubleshooting experience.").category).toBe(
        "troubleshooting",
      );
    });
  });

  describe("8. Résumé Selection, One-Page Fit & Tracker Sync", () => {
    it("verifies one-page fit, creates tailored one-page résumés, and syncs to Application Tracker", () => {
      const versions = ensureResumeVersions();
      expect(versions.length).toBeGreaterThan(0);
      expect(checkResumeFitsOnePage(versions[0])).toBe(true);

      const imported = importUrlsIntoQueue(
        "https://boards.greenhouse.io/cascadecloud/jobs/4091821?title=Linux_Systems_Engineer",
        [],
        versions,
      );
      expect(imported.added).toHaveLength(1);
      const item = imported.added[0];
      expect(item.resumeFitsOnePage).toBe(true);

      const withJd = analyzeAndPrepareQueueItem(
        {
          ...item,
          jobDescription:
            "Required: Linux, Ubuntu, Bash, Python, TCP/IP, DNS, DHCP, AWS, troubleshooting.",
        },
        versions,
      );
      expect(withJd.matchScore).not.toBeNull();
      expect(withJd.matchedSkills.length).toBeGreaterThan(0);

      const tailored = createTailoredOnePageResumeForQueueItem(withJd);
      expect(tailored.version.kind).toBe("tailored");
      expect(checkResumeFitsOnePage(tailored.version)).toBe(true);

      const trackerId = syncQueueItemToApplicationTracker({
        ...withJd,
        status: "Submitted and verified",
        submittedAt: new Date().toISOString(),
      });
      expect(trackerId).toBeTruthy();

      const bundle = exportAutoApplyBundleJson([withJd], buildSharedProfileSubset(loadApplicantProfile(), DEFAULT_CONSENTED_FIELDS));
      const reimported = importAutoApplyBundleJson(bundle);
      expect(reimported.ok).toBe(true);
      expect(reimported.queue).toHaveLength(1);
    });
  });

  describe("9. DOM Field Discovery, Autofill & Read-Back Verification", () => {
    it("discovers form fields, autofills approved fields, verifies DOM values, and skips sensitive fields", () => {
      const container = document.createElement("div");
      container.innerHTML = `
        <form data-testid="synthetic-application-form">
          <label for="first_name">First Name *</label>
          <input id="first_name" name="first_name" type="text" required />
          <label for="email">Email Address *</label>
          <input id="email" name="email" type="email" required />
          <label for="visa">Will you require visa sponsorship?</label>
          <select id="visa" name="visa">
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </form>
      `;
      document.body.appendChild(container);

      const profile = loadApplicantProfile();
      const subset = buildSharedProfileSubset(profile, DEFAULT_CONSENTED_FIELDS);
      const discovered = discoverFormFields(container, subset);
      expect(discovered).toHaveLength(3);

      const visaField = discovered.find((f) => f.idAttr === "visa");
      expect(visaField?.confidence).toBe("sensitive_manual");

      const report = executeFormAutofill(container, subset);
      expect(report.filledCount).toBe(2);
      expect(report.skippedSensitiveCount).toBe(1);

      const firstNameInput = container.querySelector("#first_name") as HTMLInputElement;
      const emailInput = container.querySelector("#email") as HTMLInputElement;
      const visaSelect = container.querySelector("#visa") as HTMLSelectElement;

      expect(firstNameInput.value).toBe(profile.firstName);
      expect(emailInput.value).toBe(profile.email);
      expect(visaSelect.value).toBe("");

      container.remove();
    });
  });
});
