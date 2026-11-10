import { getLocal } from "../../../hooks/useLocal";
import { normalizeJob } from "../job/requirements";
import { parseResumeText } from "../parse/parseResume";
import { defaultSettings, emptyResume, newVersion } from "./defaults";
import type { DocumentSettings, ResumeVersion } from "./types";

/** Structured versions live under a new key; the legacy text-only key is left untouched. */
export const RESUME_DOCS_KEY = "pd:careeros:resume-documents";
export const LEGACY_VERSIONS_KEY = "pd:careeros:resume-versions";

type LegacyVersion = { id?: string; name?: string; text?: string; createdAt?: string };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Fill any fields missing from older saved versions so the editor never crashes. */
export function normalizeVersion(value: unknown): ResumeVersion | null {
  if (!isObject(value) || !isObject(value.resume)) return null;
  const base = newVersion(String(value.name || "Résumé"));
  const resume = { ...emptyResume(), ...(value.resume as object) } as ResumeVersion["resume"];
  resume.contact = { ...emptyResume().contact, ...(resume.contact || {}) };
  const settings = { ...defaultSettings(), ...(isObject(value.settings) ? (value.settings as Partial<DocumentSettings>) : {}) };
  settings.fontSize = Math.max(10, Math.min(13, Number(settings.fontSize) || 11));
  return {
    ...base,
    ...(value as Partial<ResumeVersion>),
    resume,
    settings,
    issues: Array.isArray(value.issues) ? (value.issues as ResumeVersion["issues"]) : [],
    resolvedIssues: Array.isArray(value.resolvedIssues) ? (value.resolvedIssues as string[]) : [],
    job: normalizeJob(value.job),
  };
}

export function migrateLegacy(legacy: unknown): ResumeVersion[] {
  if (!Array.isArray(legacy)) return [];
  return legacy
    .filter((item): item is LegacyVersion => isObject(item))
    .map((item) => {
      const text = String(item.text || "");
      const parsed = text.trim() ? parseResumeText(text) : { resume: emptyResume(), issues: [] };
      return newVersion(String(item.name || "Résumé"), parsed.resume, {
        id: item.id || undefined,
        createdAt: item.createdAt || new Date().toISOString(),
        issues: parsed.issues,
        source: text.trim() ? { fileName: "", kind: "paste", importedAt: new Date().toISOString(), extractedText: text } : undefined,
      });
    })
    .map((version) => ({ ...version, id: version.id || newVersion("x").id }));
}

export function loadVersions(): ResumeVersion[] {
  const stored = getLocal<unknown>(RESUME_DOCS_KEY, null);
  if (Array.isArray(stored)) return stored.map(normalizeVersion).filter((version): version is ResumeVersion => version !== null);
  return migrateLegacy(getLocal<unknown>(LEGACY_VERSIONS_KEY, []));
}
