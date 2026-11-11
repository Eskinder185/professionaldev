/**
 * Structured résumé schema. The document renderer, editors, and (later) job
 * matching all work from this shape instead of a single free-text field.
 */

export type ContactInfo = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
  /** Any other links or contact lines that did not fit a known field. */
  other: string[];
};

export type SkillCategory = { id: string; name: string; skills: string[] };

export type ExperienceEntry = {
  id: string;
  title: string;
  employer: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
};

export type ProjectEntry = {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  role: string;
  startDate: string;
  endDate: string;
  bullets: string[];
  githubUrl: string;
  liveUrl: string;
};

export type EducationEntry = {
  id: string;
  institution: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa: string;
  details: string[];
};

export type CertificationEntry = { id: string; name: string; issuer: string; date: string; credentialId: string };

export type SimpleItem = { id: string; text: string };

export type CustomSection = { id: string; title: string; items: SimpleItem[] };

export type Resume = {
  contact: ContactInfo;
  targetRole: string;
  summary: string;
  skills: SkillCategory[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  awards: SimpleItem[];
  publications: SimpleItem[];
  custom: CustomSection[];
};

export type SectionKey =
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "awards"
  | "publications"
  | `custom:${string}`;

export const STANDARD_SECTIONS: Exclude<SectionKey, `custom:${string}`>[] = [
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
  "certifications",
  "awards",
  "publications",
];

export const SECTION_LABELS: Record<Exclude<SectionKey, `custom:${string}`>, string> = {
  summary: "Professional Summary",
  skills: "Technical Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  awards: "Awards",
  publications: "Publications",
};

export type ParseIssue = {
  id: string;
  severity: "info" | "warning";
  /** Section the issue belongs to, used to jump to the right editor. */
  section: SectionKey | "contact" | "extraction";
  message: string;
  /** The original extracted line(s) the issue refers to, for transparency. */
  source?: string;
};

export type TemplateId = "classic" | "modern" | "technical";
export type PaperSize = "letter" | "a4";
export type FontChoice = "arial" | "calibri" | "georgia" | "times" | "garamond";

export type DocumentSettings = {
  template: TemplateId;
  paper: PaperSize;
  font: FontChoice;
  /** Body size in points. Never below 10 to keep text readable. */
  fontSize: number;
  /** Page margin in inches. */
  margin: number;
  /** Space before each section heading, in points. */
  sectionSpacing: number;
  /** Bullet indent in points. */
  bulletIndent: number;
  headerLayout: "left" | "center";
  pagePreference: "one" | "multi";
  sectionOrder: SectionKey[];
  /** Sections excluded from the document. Their content stays in the résumé data. */
  hiddenSections?: SectionKey[];
  /** Line pitch as a multiple of font size (default 1.22). */
  lineSpacing?: number;
};

export type ImportSource = {
  fileName: string;
  kind: "pdf" | "docx" | "txt" | "paste";
  importedAt: string;
  sizeBytes?: number;
  /** Text exactly as extracted, before parsing, so nothing is silently lost. */
  extractedText: string;
};

/** How a job description presents a requirement. */
export type RequirementKind = "required" | "preferred" | "responsibility" | "context";

/** The user's own statement about a requirement. Never written into the résumé automatically. */
export type Possession = "unanswered" | "has" | "not" | "uncertain";

export type Requirement = {
  id: string;
  /** Normalized name, e.g. "AWS IAM". */
  term: string;
  /** Exact wording found in the job description, e.g. "AWS Identity and Access Management". */
  phrases: string[];
  /** Sentence(s) the term appeared in, for transparency. */
  snippets: string[];
  /** The kind of line each snippet came from, so evidence can quote the line that justifies the final kind. */
  snippetKinds?: RequirementKind[];
  category: string;
  kind: RequirementKind;
  /** Included in coverage review. Preselected for detected requirements. */
  selected: boolean;
  possession: Possession;
  origin: "detected" | "user";
  /** Lower-confidence detections (unknown acronyms, inferred kinds) are flagged for review. */
  uncertain?: boolean;
};

export type JobMetadata = {
  company?: string;
  location?: string;
  workMode?: "Remote" | "Hybrid" | "On-site";
  compensation?: string;
  employmentType?: string;
};

export type JobTarget = {
  title: string;
  company?: string;
  description: string;
  analyzedAt?: string;
  /** Description text at the time of the last analysis, to warn when it has changed. */
  analyzedDescription?: string;
  requirements: Requirement[];
  metadata?: JobMetadata;
  /** Detected terms the user removed; re-analysis will not bring them back. */
  removedTerms?: string[];
  /** Suggestion keys the user rejected; they stay hidden. */
  rejectedSuggestions?: string[];
};

export type ResumeVersion = {
  id: string;
  name: string;
  /** Master Profile holds the complete verified history; tailored versions are one-page job documents. */
  kind?: "master" | "tailored";
  /** ID of the Master Profile this tailored résumé was created from. */
  masterId?: string;
  company?: string;
  role?: string;
  /** Id of the job posting (CareerOS job store) this tailored version was made for. */
  jobId?: string;
  /** Documents-library flags. */
  favorite?: boolean;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
  resume: Resume;
  settings: DocumentSettings;
  source?: ImportSource;
  issues: ParseIssue[];
  /** Issue ids the user has reviewed and dismissed. */
  resolvedIssues: string[];
  /** Target job description and the requirements extracted from it. */
  job?: JobTarget;
};
