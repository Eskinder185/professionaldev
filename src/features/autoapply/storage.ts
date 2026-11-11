import { getLocal, setLocal } from "../../hooks/useLocal";
import type { Application } from "../applications/ApplicationsPage";
import { layoutResume } from "../resume/layout/engine";
import { defaultMeasurer } from "../resume/layout/measurer";
import { defaultSettings, newVersion, uid } from "../resume/model/defaults";
import { RESUME_DOCS_KEY, loadVersions } from "../resume/model/storage";
import type { Resume, ResumeVersion } from "../resume/model/types";
import { resumeToPlainText } from "../resume/parse/parseResume";
import { analyzeJob } from "../resume/job/requirements";
import { matchResume } from "../resume/job/match";
import { buildTailoredProposal } from "../resume/tailor/tailorEngine";
import { importJobUrlBatch, validateAndAnalyzeJobUrl } from "../../../packages/careeros-shared/schemas";
import type {
  ApplicantProfile,
  AutoApplyQueueItem,
  PreparedQuestionDraft,
  QueueStatus,
  SharedProfileSubset,
  StandardProfileFieldKey,
} from "../../../packages/careeros-shared/types";

export const AUTOAPPLY_QUEUE_KEY = "pd:careeros:autoapply-queue";
export const AUTOAPPLY_PROFILE_KEY = "pd:careeros:autoapply-profile";
export const AUTOAPPLY_CONSENT_KEY = "pd:careeros:autoapply-consented-fields";
export const APP_TRACKER_KEY = "appTracker:items";

export const DEFAULT_CONSENTED_FIELDS: StandardProfileFieldKey[] = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "city",
  "state",
  "location",
  "country",
  "linkedin",
  "github",
  "website",
  "headline",
  "currentEmployer",
  "currentTitle",
  "school",
  "degree",
  "major",
  "graduationDate",
  "skillsSummary",
  "certificationsSummary",
  "experienceSummary",
  "customQuestion",
];

/**
 * Default verified starter Master Profile for CareerOS when no ResumeVersion exists yet.
 */
export function defaultMasterResume(): Resume {
  return {
    contact: {
      name: "Alex Rivera",
      headline: "Cloud & Infrastructure Systems Engineer",
      email: "alex.rivera@example.com",
      phone: "(206) 555-0148",
      location: "Seattle, WA",
      linkedin: "https://linkedin.com/in/alexrivera-sys",
      github: "https://github.com/alexrivera-sys",
      website: "https://alexrivera.dev",
      other: [],
    },
    targetRole: "Cloud Infrastructure Engineer",
    summary:
      "Systems and Cloud Infrastructure Engineer experienced in Linux server administration, network troubleshooting, hardware diagnostics, and automated incident recovery across high-availability environments.",
    skills: [
      {
        id: "sk-1",
        name: "Systems & Cloud",
        skills: ["Linux (Ubuntu, RHEL)", "Windows Server", "Docker", "AWS EC2/S3/IAM", "Terraform", "Bash", "Python"],
      },
      {
        id: "sk-2",
        name: "Networking & Operations",
        skills: ["TCP/IP", "DNS", "DHCP", "VLANs", "Wireshark", "Hardware Diagnostics", "RAID", "Prometheus/Grafana"],
      },
    ],
    experience: [
      {
        id: "exp-1",
        employer: "Cascade Cloud Systems",
        title: "Infrastructure Support Engineer",
        location: "Seattle, WA",
        startDate: "2023",
        endDate: "Present",
        current: true,
        bullets: [
          "Diagnosed and resolved 45+ weekly Linux, network, and rack hardware tickets across 300+ production nodes while maintaining 99.95% SLA compliance.",
          "Automated server health checks and log collection using Bash and Python scripts, reducing mean time to resolution (MTTR) by 28%.",
          "Performed rack-and-stack deployments, fiber/copper cabling verification, and BMC/IPMI firmware updates for bare-metal clusters.",
        ],
      },
      {
        id: "exp-2",
        employer: "Northwind IT Operations",
        title: "Systems & Network Technician",
        location: "Tacoma, WA",
        startDate: "2021",
        endDate: "2023",
        current: false,
        bullets: [
          "Supported 250+ enterprise workstations and Linux/Windows servers, resolving DNS, DHCP, VPN, and Active Directory authentication issues.",
          "Documented 30+ standard operating procedures (SOPs) for incident triage, backup verification, and hardware RMA workflows.",
        ],
      },
    ],
    projects: [
      {
        id: "proj-1",
        name: "Automated Linux Node Diagnostics Toolkit",
        description: "Lightweight CLI utility for Linux node health checks",
        role: "Creator",
        technologies: ["Python", "Bash", "Linux", "Systemd"],
        githubUrl: "https://github.com/alexrivera-sys/node-diag",
        liveUrl: "",
        startDate: "2024",
        endDate: "2024",
        bullets: [
          "Built a lightweight CLI utility that inspects disk SMART health, memory errors, network interface drops, and systemd service states in under 5 seconds.",
        ],
      },
    ],
    education: [
      {
        id: "edu-1",
        institution: "University of Washington",
        degree: "B.S.",
        field: "Information Technology",
        location: "Seattle, WA",
        startDate: "2017",
        endDate: "2021",
        gpa: "",
        details: ["Coursework: Operating Systems, Computer Networks, Distributed Systems, Cybersecurity"],
      },
    ],
    certifications: [
      {
        id: "cert-1",
        name: "CompTIA Linux+",
        issuer: "CompTIA",
        date: "2023",
        credentialId: "",
      },
      {
        id: "cert-2",
        name: "AWS Certified Cloud Practitioner",
        issuer: "Amazon Web Services",
        date: "2024",
        credentialId: "",
      },
    ],
    awards: [],
    publications: [],
    custom: [],
  };
}

export function ensureResumeVersions(): ResumeVersion[] {
  const existing = loadVersions();
  if (existing.length > 0) return existing;
  const master = newVersion("Master One-Page ATS Résumé", defaultMasterResume(), {
    kind: "master",
    settings: defaultSettings("classic"),
  });
  setLocal(RESUME_DOCS_KEY, [master]);
  return [master];
}

export function checkResumeFitsOnePage(version: ResumeVersion): boolean {
  try {
    const layout = layoutResume(version.resume, version.settings, defaultMeasurer);
    return layout.fit.fitsOnePage;
  } catch {
    return true;
  }
}

/**
 * Derives an ApplicantProfile from the active Master Profile in Résumé Studio 3.0,
 * merged with any user-saved AutoApply profile refinements.
 */
export function loadApplicantProfile(): ApplicantProfile {
  const versions = ensureResumeVersions();
  const master = versions.find((v) => v.kind === "master") ?? versions[0];
  const r = master.resume;

  const fullName = (r.contact.name || "Alex Rivera").trim();
  const parts = fullName.split(/\s+/);
  const firstName = parts[0] || "Alex";
  const lastName = parts.slice(1).join(" ") || "Rivera";

  const locParts = (r.contact.location || "Seattle, WA").split(",").map((s) => s.trim());
  const city = locParts[0] || "Seattle";
  const state = locParts[1] || "WA";

  const derived: ApplicantProfile = {
    firstName,
    lastName,
    preferredName: firstName,
    email: r.contact.email || "alex.rivera@example.com",
    phone: r.contact.phone || "(206) 555-0148",
    city,
    state,
    country: "United States",
    linkedin: r.contact.linkedin || "https://linkedin.com/in/alexrivera-sys",
    github: r.contact.github || "https://github.com/alexrivera-sys",
    website: r.contact.website || "https://alexrivera.dev",
    headline: r.contact.headline || r.targetRole || "Cloud & Infrastructure Systems Engineer",
    education: r.education.map((e) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field || "Information Technology",
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
    experience: r.experience.map((ex) => ({
      employer: ex.employer,
      title: ex.title,
      location: ex.location,
      startDate: ex.startDate,
      endDate: ex.endDate,
      current: ex.current,
      bullets: ex.bullets,
    })),
    skills: r.skills.flatMap((g) => g.skills),
    certifications: r.certifications.map((c) => (c.issuer ? `${c.name} (${c.issuer})` : c.name)),
    savedAnswers: [],
    updatedAt: new Date().toISOString(),
  };

  const stored = getLocal<Partial<ApplicantProfile> | null>(AUTOAPPLY_PROFILE_KEY, null);
  if (!stored || typeof stored !== "object") {
    return derived;
  }

  return {
    ...derived,
    ...stored,
    education:
      Array.isArray(stored.education) && stored.education.length > 0
        ? stored.education
        : derived.education,
    experience:
      Array.isArray(stored.experience) && stored.experience.length > 0
        ? stored.experience
        : derived.experience,
    skills:
      Array.isArray(stored.skills) && stored.skills.length > 0 ? stored.skills : derived.skills,
    certifications:
      Array.isArray(stored.certifications) && stored.certifications.length > 0
        ? stored.certifications
        : derived.certifications,
    savedAnswers: Array.isArray(stored.savedAnswers) ? stored.savedAnswers : [],
  };
}

export function saveApplicantProfile(profile: ApplicantProfile): void {
  setLocal(AUTOAPPLY_PROFILE_KEY, {
    ...profile,
    updatedAt: new Date().toISOString(),
  });
}

export function loadConsentedFields(): StandardProfileFieldKey[] {
  const stored = getLocal<StandardProfileFieldKey[] | null>(AUTOAPPLY_CONSENT_KEY, null);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return [...DEFAULT_CONSENTED_FIELDS];
}

export function saveConsentedFields(fields: StandardProfileFieldKey[]): void {
  setLocal(AUTOAPPLY_CONSENT_KEY, fields);
}

export function buildSharedProfileSubset(
  profile: ApplicantProfile,
  consentedFields: StandardProfileFieldKey[],
  selectedResume?: ResumeVersion,
  preparedQuestions: PreparedQuestionDraft[] = [],
): SharedProfileSubset {
  const fullMap: Record<StandardProfileFieldKey, string> = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: `${profile.firstName} ${profile.lastName}`.trim(),
    preferredName: profile.preferredName || profile.firstName,
    email: profile.email,
    phone: profile.phone,
    city: profile.city,
    state: profile.state,
    location: [profile.city, profile.state].filter(Boolean).join(", "),
    country: profile.country,
    linkedin: profile.linkedin,
    github: profile.github,
    website: profile.website,
    headline: profile.headline,
    currentEmployer: profile.experience[0]?.employer ?? "",
    currentTitle: profile.experience[0]?.title ?? profile.headline,
    school: profile.education[0]?.institution ?? "",
    degree: profile.education[0]?.degree ?? "",
    major: profile.education[0]?.field ?? "",
    graduationDate: profile.education[0]?.endDate ?? "",
    skillsSummary: profile.skills.join(", "),
    certificationsSummary: profile.certifications.join(", "),
    experienceSummary: profile.experience
      .map((e) => `${e.title} at ${e.employer} (${e.startDate}–${e.endDate}): ${e.bullets.join(" ")}`)
      .join(" | "),
    coverLetter: "",
    customQuestion: "",
  };

  const allowedValues: Partial<Record<StandardProfileFieldKey, string>> = {};
  for (const key of consentedFields) {
    if (key in fullMap) {
      allowedValues[key] = fullMap[key];
    }
  }

  const preparedAnswers: NonNullable<SharedProfileSubset["preparedAnswers"]> = {};
  for (const q of preparedQuestions) {
    preparedAnswers[q.id] = {
      question: q.question,
      answer: q.draftAnswer,
      evidence: q.evidence,
      approved: q.approved,
    };
  }
  for (const saved of profile.savedAnswers) {
    preparedAnswers[saved.id] = {
      question: saved.questionLabel,
      answer: saved.answer,
      evidence: saved.evidence,
      approved: true,
    };
  }

  return {
    approvedAt: new Date().toISOString(),
    sharedFields: consentedFields,
    values: allowedValues,
    education: profile.education,
    experience: profile.experience,
    skills: profile.skills,
    certifications: profile.certifications,
    resumeVersionId: selectedResume?.id,
    resumeVersionName: selectedResume?.name,
    resumeFileName: selectedResume
      ? `${selectedResume.name.replace(/[^a-zA-Z0-9_-]+/g, "_")}.pdf`
      : "CareerOS_One_Page_ATS_Resume.pdf",
    resumePlainText: selectedResume ? resumeToPlainText(selectedResume.resume) : undefined,
    preparedAnswers,
  };
}

export function loadAutoApplyQueue(): AutoApplyQueueItem[] {
  const raw = getLocal<AutoApplyQueueItem[] | null>(AUTOAPPLY_QUEUE_KEY, null);
  if (Array.isArray(raw)) return raw;
  return [];
}

export function saveAutoApplyQueue(items: AutoApplyQueueItem[]): void {
  setLocal(AUTOAPPLY_QUEUE_KEY, items);
}

/**
 * Syncs an AutoApplyQueueItem with CareerOS Application Tracker (`appTracker:items`).
 */
export function syncQueueItemToApplicationTracker(item: AutoApplyQueueItem): string {
  const trackerItems = getLocal<Application[]>(APP_TRACKER_KEY, []);
  const trackerStatus =
    item.status === "Submitted and verified"
      ? "Applied"
      : item.status === "Ready for autofill" ||
          item.status === "Autofill in progress" ||
          item.status === "Ready for review"
        ? "Preparing"
        : "Saved";

  const existingIdx = trackerItems.findIndex(
    (t) =>
      (item.trackerApplicationId && t.id === item.trackerApplicationId) ||
      (t.url && t.url === item.url) ||
      (t.company.toLowerCase() === item.company.toLowerCase() &&
        t.role.toLowerCase() === item.title.toLowerCase()),
  );

  const dateStr = (item.submittedAt || item.updatedAt || new Date().toISOString()).slice(0, 10);

  if (existingIdx >= 0) {
    const existing = trackerItems[existingIdx];
    const updated: Application = {
      ...existing,
      company: item.company || existing.company,
      role: item.title || existing.role,
      status: trackerStatus,
      date: dateStr,
      url: item.url,
      notes: item.notes || existing.notes,
      followUp: item.followUpDate || existing.followUp,
    };
    const next = [...trackerItems];
    next[existingIdx] = updated;
    setLocal(APP_TRACKER_KEY, next);
    return existing.id;
  }

  const newId = item.trackerApplicationId || uid();
  const created: Application = {
    id: newId,
    company: item.company || "Company not extracted",
    role: item.title || "Role title needed",
    status: trackerStatus,
    date: dateStr,
    url: item.url,
    notes: item.notes || `AutoApply (${item.platform}) — ${item.selectedResumeName}`,
    followUp: item.followUpDate || "",
  };
  setLocal(APP_TRACKER_KEY, [created, ...trackerItems]);
  return newId;
}

export function computeNextActionForStatus(status: QueueStatus): string {
  switch (status) {
    case "Imported":
      return "Add or confirm job description & details";
    case "Analysis needed":
      return "Paste job description to compute match score";
    case "Ready to prepare":
      return "Select one-page résumé & prepare answers";
    case "Needs information":
      return "Complete missing profile or question details";
    case "Ready for autofill":
      return "Open application & run Extension Autofill";
    case "Autofill in progress":
      return "Complete autofill on application form";
    case "Ready for review":
      return "Review filled fields & submit manually";
    case "Submitted and verified":
      return "Track follow-up in Applications";
    case "Unsupported":
      return "Use guided copy-paste checklist";
    case "Failed":
      return "Inspect form errors & retry";
    case "Skipped":
      return "Skipped by user";
  }
}

/**
 * Evaluates a queue item against the user's ResumeVersions, selecting the best 1-page résumé
 * and computing match score when jobDescription is available.
 */
export function analyzeAndPrepareQueueItem(
  item: AutoApplyQueueItem,
  versions: ResumeVersion[],
  preparedQuestions?: PreparedQuestionDraft[],
): AutoApplyQueueItem {
  const master = versions.find((v) => v.kind === "master") ?? versions[0];
  const chosenVersion =
    versions.find((v) => v.id === item.selectedResumeId) ??
    versions.find(
      (v) =>
        item.company &&
        item.title &&
        v.name.toLowerCase().includes(item.company.toLowerCase()),
    ) ??
    master;

  const fitsOnePage = chosenVersion ? checkResumeFitsOnePage(chosenVersion) : true;

  let matchScore = item.matchScore;
  let matchedSkills = item.matchedSkills;
  let missingSkills = item.missingSkills;

  if (item.jobDescription.trim().length > 15 && chosenVersion) {
    const analyzedJob = analyzeJob({
      title: item.title,
      company: item.company,
      description: item.jobDescription,
      requirements: [],
    });
    const match = matchResume(chosenVersion.resume, analyzedJob.requirements, chosenVersion.settings, 1);
    matchScore = match.score;
    matchedSkills = match.matches
      .filter((m) => m.group === "matched")
      .map((m) => m.requirement.term);
    missingSkills = match.matches
      .filter((m) => m.group === "missing")
      .map((m) => m.requirement.term);
  }

  const missingInfo: string[] = [];
  if (!item.company.trim() || item.company === "Company not extracted") {
    missingInfo.push("Company name");
  }
  if (!item.title.trim() || item.title === "Role title needed") {
    missingInfo.push("Job title");
  }

  const questions = preparedQuestions ?? item.preparedQuestions;
  const hasUnapprovedRequiredQuestion = questions.some(
    (q) => !q.requiresDirectUserInput && !q.approved,
  );

  let nextStatus: QueueStatus = item.status;
  if (item.platform === "unsupported") {
    nextStatus = "Unsupported";
  } else if (item.status !== "Submitted and verified" && item.status !== "Skipped") {
    if (missingInfo.length > 0) {
      nextStatus = "Needs information";
    } else if (!item.jobDescription.trim()) {
      nextStatus = "Ready for autofill";
    } else if (hasUnapprovedRequiredQuestion) {
      nextStatus = "Ready to prepare";
    } else {
      nextStatus = "Ready for autofill";
    }
  }

  return {
    ...item,
    selectedResumeId: chosenVersion?.id ?? "",
    selectedResumeName: chosenVersion?.name ?? "Master One-Page ATS Résumé",
    resumeFitsOnePage: fitsOnePage,
    matchScore,
    matchedSkills,
    missingSkills,
    missingInfo,
    preparedQuestions: questions,
    status: nextStatus,
    nextAction: computeNextActionForStatus(nextStatus),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates a tailored one-page ResumeVersion in Résumé Studio 3.0 for a specific queue item.
 */
export function createTailoredOnePageResumeForQueueItem(
  item: AutoApplyQueueItem,
): { version: ResumeVersion; allVersions: ResumeVersion[] } {
  const versions = ensureResumeVersions();
  const master = versions.find((v) => v.kind === "master") ?? versions[0];
  const analyzedJob = analyzeJob({
    title: item.title,
    company: item.company,
    description:
      item.jobDescription ||
      `${item.title} at ${item.company}. Linux, networking, troubleshooting, cloud infrastructure.`,
    requirements: [],
  });
  const proposal = buildTailoredProposal(master.resume, master.settings, analyzedJob);
  const tailored = newVersion(proposal.versionName, proposal.tailoredResume, {
    kind: "tailored",
    masterId: master.id,
    company: item.company,
    role: item.title,
    settings: proposal.tailoredSettings,
    job: analyzedJob,
  });
  const nextVersions = [tailored, ...versions];
  setLocal(RESUME_DOCS_KEY, nextVersions);
  return { version: tailored, allVersions: nextVersions };
}

/**
 * Converts a multiline URL input into new AutoApplyQueueItems and reports duplicates/errors.
 */
export function importUrlsIntoQueue(
  multilineText: string,
  existingQueue: AutoApplyQueueItem[],
  versions: ResumeVersion[],
): {
  nextQueue: AutoApplyQueueItem[];
  added: AutoApplyQueueItem[];
  duplicates: Array<{ rawUrl: string; duplicateOf: string }>;
  invalid: Array<{ rawUrl: string; error: string }>;
} {
  const batch = importJobUrlBatch(multilineText, existingQueue, 20);
  const master = versions.find((v) => v.kind === "master") ?? versions[0];
  const fits = master ? checkResumeFitsOnePage(master) : true;

  const added: AutoApplyQueueItem[] = batch.accepted.map((parsed) => {
    const company = parsed.companyHint || "Company not extracted";
    const title = parsed.titleHint || "Role title needed";
    const isUnsupported = parsed.platform === "unsupported";
    const initialStatus: QueueStatus = isUnsupported ? "Unsupported" : "Ready for autofill";
    const now = new Date().toISOString();

    const item: AutoApplyQueueItem = {
      id: uid(),
      url: parsed.rawUrl,
      normalizedUrl: parsed.normalizedUrl || parsed.rawUrl,
      company,
      title,
      location: "",
      source: parsed.sourceHost || "direct",
      platform: parsed.platform || "generic",
      supportLevel: parsed.supportLevel || "supported",
      status: initialStatus,
      pageStage: "page_detected",
      matchScore: null,
      matchedSkills: [],
      missingSkills: [],
      missingInfo: [],
      selectedResumeId: master?.id ?? "",
      selectedResumeName: master?.name ?? "Master One-Page ATS Résumé",
      resumeFitsOnePage: fits,
      jobDescription: "",
      preparedQuestions: [],
      detectedFields: [],
      nextAction: computeNextActionForStatus(initialStatus),
      notes: "",
      followUpDate: "",
      createdAt: now,
      updatedAt: now,
    };

    const trackerId = syncQueueItemToApplicationTracker(item);
    item.trackerApplicationId = trackerId;
    return item;
  });

  const nextQueue = [...added, ...existingQueue];
  saveAutoApplyQueue(nextQueue);
  return {
    nextQueue,
    added,
    duplicates: batch.duplicates,
    invalid: batch.invalid,
  };
}

export { validateAndAnalyzeJobUrl };
