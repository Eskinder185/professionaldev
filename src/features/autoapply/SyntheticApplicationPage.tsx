import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, FileCheck2, ShieldAlert, Sparkles } from "lucide-react";
import { PLATFORM_ADAPTERS } from "../../../packages/careeros-shared/adapters";
import type {
  AutoApplyQueueItem,
  DetectedField,
  PageStage,
  PlatformId,
} from "../../../packages/careeros-shared/types";
import { sendExtensionMessage } from "./extensionBridge";
import {
  buildSharedProfileSubset,
  ensureResumeVersions,
  loadApplicantProfile,
  loadAutoApplyQueue,
  loadConsentedFields,
  saveAutoApplyQueue,
  syncQueueItemToApplicationTracker,
} from "./storage";
import "./autoapply.css";

/** Synthetic posting text for end-to-end tests of job understanding. Shown only with ?jd=1. */
export const SANDBOX_JOB_DESCRIPTION_HTML = `<h2>About the role</h2>
<p>Cascade Cloud Systems runs infrastructure for small businesses. This is a fictional posting used for testing.</p>
<h3>Responsibilities</h3>
<ul>
<li>Maintain Linux servers and respond to incidents with the on-call rotation.</li>
<li>Automate routine tasks with scripts and document fixes for the team.</li>
</ul>
<h3>Requirements</h3>
<ul>
<li>2+ years of experience in IT support or system administration.</li>
<li>Strong knowledge of Linux, Ubuntu, Bash, TCP/IP, and DNS.</li>
<li>Hands-on experience with AWS.</li>
<li>Scripting in Python.</li>
</ul>
<h3>Preferred Qualifications</h3>
<ul>
<li>Terraform experience is a plus.</li>
<li>Familiarity with Kubernetes.</li>
</ul>`;

export default function SyntheticApplicationPage() {
  const [searchParams] = useSearchParams();
  const platformParam = (searchParams.get("platform") || "generic") as PlatformId;
  const companyParam = searchParams.get("company") || "Cascade Cloud Systems";
  const roleParam = searchParams.get("role") || "Cloud Infrastructure Engineer";
  const appIdParam = searchParams.get("appId") || "";
  const locationParam = searchParams.get("location") || "Seattle, WA";
  // Salary is only ever shown when the fixture URL explicitly provides it.
  const salaryParam = searchParams.get("salary") || "";
  const coverLetterMode = (searchParams.get("coverletter") || "none") as "none" | "optional" | "required" | "file";
  const [coverLetter, setCoverLetter] = useState("");
  const showDescription = searchParams.get("jd") === "1";
  const isMultiStepInitial = searchParams.get("multistep") === "1";

  const [multiStep, setMultiStep] = useState(isMultiStepInitial);
  const [step, setStep] = useState<1 | 2>(1);

  // React-controlled form state (verifies that native prototype setter + input/change events update React state)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [country, setCountry] = useState("United States");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [website, setWebsite] = useState("");
  const [currentEmployer, setCurrentEmployer] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [school, setSchool] = useState("");
  const [degree, setDegree] = useState("");
  const [major, setMajor] = useState("");
  const [whyInterested, setWhyInterested] = useState("");
  const [troubleshootingExp, setTroubleshootingExp] = useState("");
  const [linuxExp, setLinuxExp] = useState("");
  const [technicalProblem, setTechnicalProblem] = useState("");

  // Sensitive / Manual-only fields (must NEVER be auto-filled by AutoApply)
  const [workAuth, setWorkAuth] = useState("");
  const [visaSponsorship, setVisaSponsorship] = useState("");
  const [eeoVeteran, setEeoVeteran] = useState("");
  const [salaryExpectation, setSalaryExpectation] = useState("");
  const [privacyAck, setPrivacyAck] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");

  // Submission & validation state
  const [validationError, setValidationError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Extension copilot bar state
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [approvedIds, setApprovedIds] = useState<Record<string, boolean>>({});
  const [overrideValues, setOverrideValues] = useState<Record<string, string>>({});
  const [pageStage, setPageStage] = useState<PageStage>("page_detected");
  const [copilotMessage, setCopilotMessage] = useState(
    "CareerOS AutoApply Copilot ready. Inspect form to preview mapped fields.",
  );
  const [verifiedSynced, setVerifiedSynced] = useState(false);

  const adapterMeta = PLATFORM_ADAPTERS[platformParam] ?? PLATFORM_ADAPTERS.generic;

  const findActiveQueueItem = (): AutoApplyQueueItem | null => {
    const queue = loadAutoApplyQueue();
    if (appIdParam) {
      const byId = queue.find((q) => q.id === appIdParam);
      if (byId) return byId;
    }
    return (
      queue.find(
        (q) =>
          q.company.toLowerCase() === companyParam.toLowerCase() &&
          q.title.toLowerCase() === roleParam.toLowerCase(),
      ) ??
      queue[0] ??
      null
    );
  };

  const buildCurrentSharedSubset = () => {
    const profile = loadApplicantProfile();
    const consented = loadConsentedFields();
    const versions = ensureResumeVersions();
    const activeItem = findActiveQueueItem();
    const selectedResume =
      versions.find((v) => v.id === activeItem?.selectedResumeId) ?? versions[0];
    return buildSharedProfileSubset(
      profile,
      consented,
      selectedResume,
      activeItem?.preparedQuestions ?? [],
    );
  };

  const handleInspectForm = async () => {
    const activeItem = findActiveQueueItem();
    const sharedProfile = buildCurrentSharedSubset();
    const { response } = await sendExtensionMessage<
      unknown,
      {
        pageStage: PageStage;
        detectedFields: DetectedField[];
      }
    >(
      "INSPECT_CURRENT_FORM",
      {
        applicationId: activeItem?.id,
        activeApplication: activeItem,
        sharedProfile,
      },
      { senderUrlOverride: window.location.href },
    );

    if (response.ok && response.data) {
      const fields = response.data.detectedFields ?? [];
      setDetectedFields(fields);
      setPageStage(response.data.pageStage);
      const nextApproved: Record<string, boolean> = {};
      for (const f of fields) {
        nextApproved[f.id] =
          f.confidence !== "sensitive_manual" &&
          f.reviewStatus !== "Unsupported" &&
          f.inputType !== "file" &&
          Boolean(f.preparedValue.trim());
      }
      setApprovedIds(nextApproved);
      const sensitiveCount = fields.filter((f) => f.confidence === "sensitive_manual").length;
      setCopilotMessage(
        `Detected ${fields.length} fields (${sensitiveCount} sensitive/manual fields protected from autofill).`,
      );
    }
  };

  const handleExecuteAutofill = async () => {
    const activeItem = findActiveQueueItem();
    const sharedProfile = buildCurrentSharedSubset();
    const chosenIds = Object.entries(approvedIds)
      .filter(([, checked]) => checked)
      .map(([id]) => id);

    const { response } = await sendExtensionMessage<
      unknown,
      {
        pageStage: PageStage;
        detectedFields: DetectedField[];
      }
    >(
      "EXECUTE_AUTOFILL",
      {
        applicationId: activeItem?.id,
        activeApplication: activeItem,
        sharedProfile,
        approvedFieldIds: chosenIds.length > 0 ? chosenIds : undefined,
        overrideValues,
      },
      { senderUrlOverride: window.location.href },
    );

    if (response.ok && response.data) {
      setDetectedFields(response.data.detectedFields ?? []);
      setPageStage(response.data.pageStage);
      setCopilotMessage(
        "Autofill completed and verified in DOM. Review all fields, answer any sensitive questions manually, and click Submit Application.",
      );

      // Update queue item to "Ready for review" (NEVER "Submitted and verified" until confirmation)
      if (activeItem) {
        const queue = loadAutoApplyQueue();
        const updated = queue.map((q) =>
          q.id === activeItem.id
            ? {
                ...q,
                status: "Ready for review" as const,
                pageStage: response.data!.pageStage,
                detectedFields: response.data!.detectedFields,
                nextAction: "Review filled fields & submit manually",
                updatedAt: new Date().toISOString(),
              }
            : q,
        );
        saveAutoApplyQueue(updated);
      }
    }
  };

  const handleConfirmVerifiedSubmission = async () => {
    const activeItem = findActiveQueueItem();
    const sharedProfile = buildCurrentSharedSubset();
    const { response } = await sendExtensionMessage<
      unknown,
      {
        pageStage: PageStage;
        confirmed: boolean;
      }
    >(
      "CONFIRM_SUBMISSION",
      {
        applicationId: activeItem?.id,
        activeApplication: activeItem,
        sharedProfile,
      },
      { senderUrlOverride: window.location.href },
    );

    if (response.ok && response.data?.confirmed) {
      setPageStage("completion_confirmed");
      setVerifiedSynced(true);
      setCopilotMessage(
        "Submission confirmation verified! Application status updated to 'Submitted and verified' in CareerOS.",
      );
      if (activeItem) {
        const queue = loadAutoApplyQueue();
        const now = new Date().toISOString();
        const nextQueue = queue.map((q) => {
          if (q.id !== activeItem.id) return q;
          const nextItem: AutoApplyQueueItem = {
            ...q,
            status: "Submitted and verified",
            pageStage: "completion_confirmed",
            submittedAt: now,
            confirmationText: `Application submitted for ${roleParam} at ${companyParam}`,
            nextAction: "Track follow-up in Applications",
            updatedAt: now,
          };
          syncQueueItemToApplicationTracker(nextItem);
          return nextItem;
        });
        saveAutoApplyQueue(nextQueue);
      }
    } else {
      setCopilotMessage(
        "No submission confirmation banner detected yet. Submit the application form first.",
      );
    }
  };

  const handleUserSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setValidationError("First Name, Last Name, and Email are required before submitting.");
      setPageStage("validation_needed");
      return;
    }
    setValidationError("");
    setSubmitted(true);
  };

  useEffect(() => {
    // Sync active queue item into extension state on mount so popup/sidepanel see it immediately
    const activeItem = findActiveQueueItem();
    const sharedProfile = buildCurrentSharedSubset();
    if (activeItem) {
      sendExtensionMessage("PREPARE_APPLICATION", {
        application: activeItem,
        applicationId: activeItem.id,
        profile: sharedProfile,
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appIdParam, companyParam, roleParam]);

  return (
    <div className="aa-sandbox-wrap" data-testid="synthetic-application-page">
      {/* Embedded CareerOS AutoApply Copilot Bar */}
      <aside className="aa-copilot-bar" aria-label="CareerOS AutoApply Copilot" data-testid="aa-copilot-bar">
        <div className="aa-copilot-top">
          <div>
            <span className="aa-badge aa-badge-primary">CareerOS AutoApply Copilot</span>
            <strong className="aa-copilot-title">
              {companyParam} — {roleParam}
            </strong>
            <span className="aa-badge" data-testid="sandbox-platform-badge">
              Platform: {adapterMeta.label} ({adapterMeta.supportLevel})
            </span>
            <span className="aa-badge" data-testid="sandbox-stage-badge">
              Stage: {pageStage}
            </span>
          </div>
          <div className="aa-copilot-actions">
            <button
              type="button"
              className="aa-btn aa-btn-secondary"
              onClick={handleInspectForm}
              data-testid="sandbox-btn-inspect"
            >
              Inspect Form
            </button>
            <button
              type="button"
              className="aa-btn aa-btn-primary"
              onClick={handleExecuteAutofill}
              disabled={platformParam === "unsupported"}
              data-testid="sandbox-btn-autofill"
            >
              <Sparkles size={15} /> Fill Approved Fields
            </button>
            <button
              type="button"
              className="aa-btn aa-btn-success"
              onClick={handleConfirmVerifiedSubmission}
              data-testid="sandbox-btn-verify-submission"
            >
              <FileCheck2 size={15} /> Verify &amp; Mark Submitted
            </button>
            <Link to="/autoapply" className="aa-btn aa-btn-secondary" data-testid="sandbox-back-to-autoapply">
              Back to AutoApply Queue
            </Link>
          </div>
        </div>

        <p className="aa-copilot-msg" aria-live="polite" data-testid="sandbox-copilot-message">
          {copilotMessage}
        </p>

        {detectedFields.length > 0 && (
          <div className="aa-copilot-table-wrap" data-testid="sandbox-detected-fields-panel">
            <table className="aa-table aa-copilot-table">
              <thead>
                <tr>
                  <th>Approve</th>
                  <th>Detected question</th>
                  <th>Prepared answer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {detectedFields.map((f) => {
                  const isManual =
                    f.confidence === "sensitive_manual" ||
                    f.reviewStatus === "Unsupported" ||
                    f.inputType === "file";
                  return (
                    <tr key={f.id} data-testid={`detected-row-${f.mappedKey || f.id}`}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={isManual}
                          checked={!isManual && Boolean(approvedIds[f.id])}
                          onChange={(e) =>
                            setApprovedIds((prev) => ({ ...prev, [f.id]: e.target.checked }))
                          }
                          aria-label={`Approve ${f.label}`}
                        />
                      </td>
                      <td>
                        <strong>{f.label}</strong>
                        {f.required && <span className="aa-req">*</span>}
                      </td>
                      <td>
                        {isManual ? (
                          <span className="aa-sensitive-note">
                            <ShieldAlert size={13} />{" "}
                            {f.sensitiveReason || "Manual user input required"}
                          </span>
                        ) : (
                          <input
                            type="text"
                            className="aa-inline-input"
                            value={overrideValues[f.id] ?? f.preparedValue}
                            onChange={(e) =>
                              setOverrideValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                            }
                            aria-label={`Prepared answer for ${f.label}`}
                          />
                        )}
                      </td>
                      <td>
                        <span
                          className={`aa-badge ${
                            f.reviewStatus === "Filled and verified"
                              ? "aa-badge-success"
                              : f.confidence === "sensitive_manual"
                                ? "aa-badge-warning"
                                : ""
                          }`}
                        >
                          {f.reviewStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </aside>

      {/* Synthetic Employer Application Portal */}
      <div
        className="aa-employer-portal"
        data-greenhouse-form={platformParam === "greenhouse" ? "true" : undefined}
        data-lever-form={platformParam === "lever" ? "true" : undefined}
        data-ashby-form={platformParam === "ashby" ? "true" : undefined}
        data-automation-id={platformParam === "workday" ? "workdayApplicationForm" : undefined}
      >
        <header className="aa-employer-header">
          <div>
            <span className="aa-overline">SYNTHETIC APPLICATION SANDBOX ({platformParam.toUpperCase()})</span>
            <h1>
              {roleParam} — {companyParam}
            </h1>
            <p data-testid="job-location">
              {locationParam} · Full-Time · Safe Local E2E Application Fixture
            </p>
            {salaryParam && <p data-testid="job-salary">Salary range: {salaryParam}</p>}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "JobPosting",
                  title: roleParam,
                  hiringOrganization: { "@type": "Organization", name: companyParam },
                  jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: locationParam } },
                  ...(showDescription ? { description: SANDBOX_JOB_DESCRIPTION_HTML } : {}),
                }),
              }}
            />
          </div>
          {showDescription ? <div id="job-description" data-testid="sandbox-job-description" dangerouslySetInnerHTML={{ __html: SANDBOX_JOB_DESCRIPTION_HTML }} /> : null}
          <label className="aa-toggle-label">
            <input
              type="checkbox"
              checked={multiStep}
              onChange={(e) => {
                setMultiStep(e.target.checked);
                setStep(1);
              }}
              data-testid="sandbox-multistep-toggle"
            />
            Multi-step form mode
          </label>
        </header>

        {submitted ? (
          <div
            className="aa-confirmation-banner application-confirmation"
            data-testid="application-confirmation"
            data-application-submitted="true"
          >
            <CheckCircle2 size={24} />
            <div>
              <h2>Application submitted for {roleParam} at {companyParam}</h2>
              <p>
                Thank you, {firstName} {lastName}. Your application has been received by{" "}
                {companyParam}.
              </p>
              {verifiedSynced && (
                <p className="aa-verified-tag" data-testid="sandbox-verified-tag">
                  Verified and synced to CareerOS Application Tracker!
                </p>
              )}
            </div>
          </div>
        ) : (
          <form
            id="application-form"
            data-testid="synthetic-application-form"
            data-autoapply-form="true"
            onSubmit={handleUserSubmitForm}
            className="aa-employer-form"
          >
            {validationError && (
              <div className="aa-error-banner" role="alert" data-testid="sandbox-validation-error">
                {validationError}
              </div>
            )}

            {(!multiStep || step === 1) && (
              <section className="aa-form-section" data-testid="sandbox-step-1">
                <h2>Candidate Contact &amp; Profile</h2>
                <div className="aa-form-grid">
                  <label>
                    First Name *
                    <input
                      id="first_name"
                      name="first_name"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      data-testid="input-first-name"
                    />
                  </label>
                  <label>
                    Last Name *
                    <input
                      id="last_name"
                      name="last_name"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      data-testid="input-last-name"
                    />
                  </label>
                  <label>
                    Email Address *
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-email"
                    />
                  </label>
                  <label>
                    Phone Number *
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      data-testid="input-phone"
                    />
                  </label>
                  <label>
                    City
                    <input
                      id="city"
                      name="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      data-testid="input-city"
                    />
                  </label>
                  <label>
                    State / Province
                    <input
                      id="state"
                      name="state"
                      type="text"
                      value={stateVal}
                      onChange={(e) => setStateVal(e.target.value)}
                      data-testid="input-state"
                    />
                  </label>
                  <label>
                    Country
                    <select
                      id="country"
                      name="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      data-testid="input-country"
                    >
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                    </select>
                  </label>
                  <label>
                    LinkedIn Profile URL
                    <input
                      id="linkedin"
                      name="linkedin"
                      type="url"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      data-testid="input-linkedin"
                    />
                  </label>
                  <label>
                    GitHub URL
                    <input
                      id="github"
                      name="github"
                      type="url"
                      value={github}
                      onChange={(e) => setGithub(e.target.value)}
                      data-testid="input-github"
                    />
                  </label>
                  <label>
                    Portfolio Website
                    <input
                      id="website"
                      name="website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      data-testid="input-website"
                    />
                  </label>
                  <label>
                    Current Company
                    <input
                      id="current_company"
                      name="current_company"
                      type="text"
                      value={currentEmployer}
                      onChange={(e) => setCurrentEmployer(e.target.value)}
                      data-testid="input-current-company"
                    />
                  </label>
                  <label>
                    Current Title
                    <input
                      id="current_title"
                      name="current_title"
                      type="text"
                      value={currentTitle}
                      onChange={(e) => setCurrentTitle(e.target.value)}
                      data-testid="input-current-title"
                    />
                  </label>
                  <label>
                    University / School
                    <input
                      id="school"
                      name="school"
                      type="text"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      data-testid="input-school"
                    />
                  </label>
                  <label>
                    Degree
                    <input
                      id="degree"
                      name="degree"
                      type="text"
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                      data-testid="input-degree"
                    />
                  </label>
                  <label>
                    Major / Field of Study
                    <input
                      id="major"
                      name="major"
                      type="text"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      data-testid="input-major"
                    />
                  </label>
                  {(coverLetterMode === "optional" || coverLetterMode === "required") && (
                    <label>
                      Cover Letter{coverLetterMode === "optional" ? " (optional)" : ""}
                      <textarea
                        id="cover_letter"
                        name="cover_letter"
                        rows={4}
                        required={coverLetterMode === "required"}
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        data-testid="input-cover-letter"
                      />
                    </label>
                  )}
                  {coverLetterMode === "file" && (
                    <label>
                      Cover Letter (PDF)
                      <input id="cover_letter_file" name="cover_letter_file" type="file" accept=".pdf" data-testid="input-cover-letter-file" />
                    </label>
                  )}
                  <label>
                    Resume / CV (One-Page PDF/DOCX)
                    <input
                      id="resume_file"
                      name="resume_file"
                      type="file"
                      accept=".pdf,.docx"
                      onChange={(e) => setUploadedFileName(e.target.files?.[0]?.name || "")}
                      data-testid="input-resume-file"
                    />
                    {uploadedFileName && (
                      <small data-testid="uploaded-resume-filename">
                        Attached: {uploadedFileName}
                      </small>
                    )}
                  </label>
                </div>

                {multiStep && (
                  <div className="aa-form-actions">
                    <button
                      type="button"
                      className="aa-btn aa-btn-primary"
                      onClick={() => setStep(2)}
                      data-testid="sandbox-btn-next-step"
                    >
                      Continue to Step 2 (Questions &amp; Disclosures)
                    </button>
                  </div>
                )}
              </section>
            )}

            {(!multiStep || step === 2) && (
              <section className="aa-form-section" data-testid="sandbox-step-2">
                <h2>Application Questions</h2>
                <div className="aa-form-stack">
                  <label>
                    Why are you interested in this role?
                    <textarea
                      id="question_motivation"
                      name="question_motivation"
                      rows={3}
                      value={whyInterested}
                      onChange={(e) => setWhyInterested(e.target.value)}
                      data-testid="input-question-motivation"
                    />
                  </label>
                  <label>
                    Describe your troubleshooting experience.
                    <textarea
                      id="question_troubleshooting"
                      name="question_troubleshooting"
                      rows={3}
                      value={troubleshootingExp}
                      onChange={(e) => setTroubleshootingExp(e.target.value)}
                      data-testid="input-question-troubleshooting"
                    />
                  </label>
                  <label>
                    What experience do you have with Linux?
                    <textarea
                      id="question_linux"
                      name="question_linux"
                      rows={3}
                      value={linuxExp}
                      onChange={(e) => setLinuxExp(e.target.value)}
                      data-testid="input-question-linux"
                    />
                  </label>
                  <label>
                    Explain a difficult technical problem you solved.
                    <textarea
                      id="question_problem"
                      name="question_problem"
                      rows={3}
                      value={technicalProblem}
                      onChange={(e) => setTechnicalProblem(e.target.value)}
                      data-testid="input-question-problem"
                    />
                  </label>
                </div>

                <h2>Sensitive, Legal &amp; EEO Questions (Manual User Entry Only)</h2>
                <div className="aa-form-grid">
                  <label>
                    Are you legally authorized to work in the United States?
                    <select
                      id="work_authorization"
                      name="work_authorization"
                      value={workAuth}
                      onChange={(e) => setWorkAuth(e.target.value)}
                      data-testid="input-work-authorization"
                    >
                      <option value="">Select an option</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </label>
                  <label>
                    Will you now or in the future require visa sponsorship?
                    <select
                      id="visa_sponsorship"
                      name="visa_sponsorship"
                      value={visaSponsorship}
                      onChange={(e) => setVisaSponsorship(e.target.value)}
                      data-testid="input-visa-sponsorship"
                    >
                      <option value="">Select an option</option>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </label>
                  <label>
                    Voluntary Self-Identification of Veteran Status
                    <select
                      id="veteran_status"
                      name="veteran_status"
                      value={eeoVeteran}
                      onChange={(e) => setEeoVeteran(e.target.value)}
                      data-testid="input-veteran-status"
                    >
                      <option value="">Select an option</option>
                      <option value="I am not a protected veteran">I am not a protected veteran</option>
                      <option value="I identify as one or more of the classifications">
                        I identify as one or more of the classifications
                      </option>
                      <option value="I choose not to self-identify">I choose not to self-identify</option>
                    </select>
                  </label>
                  <label>
                    Desired Salary Expectations
                    <input
                      id="salary_expectations"
                      name="salary_expectations"
                      type="text"
                      value={salaryExpectation}
                      onChange={(e) => setSalaryExpectation(e.target.value)}
                      data-testid="input-salary-expectations"
                    />
                  </label>
                </div>

                <label className="aa-checkbox-row">
                  <input
                    id="privacy_ack"
                    name="privacy_ack"
                    type="checkbox"
                    checked={privacyAck}
                    onChange={(e) => setPrivacyAck(e.target.checked)}
                    data-testid="input-privacy-ack"
                  />
                  I acknowledge the candidate privacy notice.
                </label>

                <div className="aa-form-actions">
                  {multiStep && (
                    <button
                      type="button"
                      className="aa-btn aa-btn-secondary"
                      onClick={() => setStep(1)}
                      data-testid="sandbox-btn-prev-step"
                    >
                      Back to Step 1
                    </button>
                  )}
                  <button
                    type="submit"
                    className="aa-btn aa-btn-primary"
                    data-testid="sandbox-btn-submit-application"
                  >
                    Submit Application (User Action)
                  </button>
                </div>
              </section>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
