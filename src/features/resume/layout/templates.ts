import type { DocumentSettings, FontChoice, SectionKey, TemplateId } from "../model/types";
import type { PdfFamily } from "./types";

/** Readability limits. Layout never goes outside them to make content fit. */
export const LIMITS = {
  fontMin: 10,
  fontMax: 11.5,
  fontPreferredMin: 10.5,
  marginMin: 0.5,
  marginPreferredMin: 0.55,
  marginMax: 1,
  lineMin: 1.15,
  lineMax: 1.4,
  sectionSpacingMin: 4,
  sectionSpacingMax: 18,
  bulletIndentMin: 12,
  bulletIndentMax: 28,
} as const;

export const FONT_FAMILY: Record<FontChoice, PdfFamily> = {
  arial: "helvetica",
  calibri: "helvetica",
  times: "times",
  georgia: "times",
  garamond: "times",
};

export const CSS_FAMILY: Record<PdfFamily, string> = {
  helvetica: "Arial, Helvetica, 'Liberation Sans', sans-serif",
  times: "'Times New Roman', Times, 'Liberation Serif', serif",
};

export const DOCX_FAMILY: Record<PdfFamily, string> = { helvetica: "Arial", times: "Times New Roman" };

/** Ascent/descent (em fractions) used to place baselines identically in preview and PDF. */
export const FONT_BOX: Record<PdfFamily, { ascent: number; descent: number }> = {
  helvetica: { ascent: 0.905, descent: 0.212 },
  times: { ascent: 0.891, descent: 0.216 },
};

export type TemplateSpec = {
  id: TemplateId;
  label: string;
  description: string;
  defaultFont: FontChoice;
  headerAlign: "left" | "center";
  nameScale: number;
  headlineStyle: "bold" | "normal" | "italic";
  headingUpper: boolean;
  headingColor: string;
  nameColor: string;
  ruleColor: string;
  ruleWidth: number;
  /** Which line leads an experience entry. */
  entryLead: "employer" | "title";
  certLayout: "inline" | "list";
  /** Skills block size relative to body text (the reference résumé sets skills 0.5 pt smaller). */
  skillsDelta: number;
  order: SectionKey[];
};

export const TEMPLATE_SPECS: Record<TemplateId, TemplateSpec> = {
  classic: {
    id: "classic",
    label: "One-Page Classic",
    description: "Centered header, uppercase headings with thin rules. Modeled on the reference résumé.",
    defaultFont: "arial",
    headerAlign: "center",
    nameScale: 1.6,
    headlineStyle: "bold",
    headingUpper: true,
    headingColor: "#000000",
    nameColor: "#000000",
    ruleColor: "#000000",
    ruleWidth: 0.6,
    entryLead: "employer",
    certLayout: "inline",
    skillsDelta: -0.5,
    order: ["summary", "skills", "experience", "projects", "education", "certifications", "awards", "publications"],
  },
  technical: {
    id: "technical",
    label: "One-Page Technical",
    description: "Technical Engineer — skills, certifications and projects first. For IT, security, cloud, networking and engineering roles.",
    defaultFont: "arial",
    headerAlign: "left",
    nameScale: 1.6,
    headlineStyle: "normal",
    headingUpper: true,
    headingColor: "#111827",
    nameColor: "#000000",
    ruleColor: "#111827",
    ruleWidth: 1,
    entryLead: "title",
    certLayout: "inline",
    skillsDelta: -0.5,
    order: ["summary", "skills", "certifications", "projects", "experience", "education", "awards", "publications"],
  },
  modern: {
    id: "modern",
    label: "One-Page Modern",
    description: "Restrained modern typography and spacing. Single column, no graphics.",
    defaultFont: "arial",
    headerAlign: "left",
    nameScale: 1.75,
    headlineStyle: "normal",
    headingUpper: false,
    headingColor: "#1f3a5f",
    nameColor: "#1f3a5f",
    ruleColor: "#c5d1e0",
    ruleWidth: 0.8,
    entryLead: "title",
    certLayout: "list",
    skillsDelta: 0,
    order: ["summary", "experience", "projects", "skills", "education", "certifications", "awards", "publications"],
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

/** Settings after readability limits are applied. Saved documents may hold older values. */
export function effectiveSettings(settings: DocumentSettings): DocumentSettings & { lineSpacing: number } {
  return {
    ...settings,
    fontSize: clamp(settings.fontSize, LIMITS.fontMin, LIMITS.fontMax),
    margin: clamp(settings.margin, LIMITS.marginMin, LIMITS.marginMax),
    sectionSpacing: clamp(settings.sectionSpacing, LIMITS.sectionSpacingMin, LIMITS.sectionSpacingMax),
    bulletIndent: clamp(settings.bulletIndent, LIMITS.bulletIndentMin, LIMITS.bulletIndentMax),
    lineSpacing: clamp(settings.lineSpacing ?? 1.22, LIMITS.lineMin, LIMITS.lineMax),
  };
}
