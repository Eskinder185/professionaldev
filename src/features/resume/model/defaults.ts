import type { DocumentSettings, Resume, ResumeVersion, SectionKey, TemplateId } from "./types";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const emptyResume = (): Resume => ({
  contact: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "", github: "", website: "", other: [] },
  targetRole: "",
  summary: "",
  skills: [],
  experience: [],
  projects: [],
  education: [],
  certifications: [],
  awards: [],
  publications: [],
  custom: [],
});

/** Default section order per template. Technical leads with skills and projects. */
export const TEMPLATE_ORDER: Record<TemplateId, SectionKey[]> = {
  classic: ["summary", "skills", "experience", "projects", "education", "certifications", "awards", "publications"],
  modern: ["summary", "experience", "projects", "skills", "education", "certifications", "awards", "publications"],
  technical: ["summary", "skills", "projects", "experience", "certifications", "education", "awards", "publications"],
};

export const defaultSettings = (template: TemplateId = "classic"): DocumentSettings => ({
  template,
  paper: "letter",
  font: template === "modern" ? "calibri" : template === "technical" ? "arial" : "times",
  fontSize: 11,
  margin: 0.75,
  sectionSpacing: 10,
  bulletIndent: 14,
  headerLayout: template === "modern" ? "left" : "center",
  pagePreference: "multi",
  sectionOrder: [...TEMPLATE_ORDER[template]],
});

export const FONT_STACKS: Record<DocumentSettings["font"], { label: string; css: string }> = {
  arial: { label: "Arial", css: "Arial, Helvetica, 'Liberation Sans', sans-serif" },
  calibri: { label: "Calibri", css: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif" },
  georgia: { label: "Georgia", css: "Georgia, 'DejaVu Serif', serif" },
  times: { label: "Times New Roman", css: "'Times New Roman', Times, 'Liberation Serif', serif" },
  garamond: { label: "Garamond", css: "Garamond, 'EB Garamond', 'Times New Roman', serif" },
};

export const PAPER: Record<DocumentSettings["paper"], { label: string; widthIn: number; heightIn: number }> = {
  letter: { label: "US Letter", widthIn: 8.5, heightIn: 11 },
  a4: { label: "A4", widthIn: 8.27, heightIn: 11.69 },
};

export const newVersion = (name: string, resume: Resume = emptyResume(), extra: Partial<ResumeVersion> = {}): ResumeVersion => {
  const now = new Date().toISOString();
  return { id: uid(), name, createdAt: now, updatedAt: now, resume, settings: defaultSettings(), issues: [], resolvedIssues: [], ...extra };
};

/** Every section key that has content or is explicitly ordered, custom sections included. */
export function effectiveOrder(resume: Resume, settings: DocumentSettings): SectionKey[] {
  const order = settings.sectionOrder.filter(
    (key) => !key.startsWith("custom:") || resume.custom.some((section) => `custom:${section.id}` === key),
  );
  for (const section of resume.custom) {
    const key = `custom:${section.id}` as SectionKey;
    if (!order.includes(key)) order.push(key);
  }
  for (const key of TEMPLATE_ORDER.classic) if (!order.includes(key)) order.push(key);
  return order;
}
