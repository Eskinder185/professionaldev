import type { DocumentSettings, Resume } from "../model/types";

export type DocCheck = { id: string; ok: boolean; label: string; detail: string };

const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/**
 * Document-format checks. These describe readability and structure only and
 * are kept separate from any job-requirement coverage.
 */
export function documentChecks(resume: Resume, settings: DocumentSettings, pageCount: number): DocCheck[] {
  const checks: DocCheck[] = [];
  const { contact } = resume;
  checks.push({ id: "name", ok: Boolean(contact.name.trim()), label: "Name in header", detail: contact.name ? "Your name is the first line of the document." : "Add your full name in Contact." });
  checks.push({ id: "contact", ok: Boolean(contact.email || contact.phone), label: "Contact details", detail: contact.email || contact.phone ? "Email or phone is present in plain text." : "Add an email address or phone number." });
  const core = [resume.experience.length || resume.projects.length, resume.education.length, resume.skills.some((category) => category.skills.length)];
  checks.push({ id: "sections", ok: core.every(Boolean), label: "Core sections", detail: core.every(Boolean) ? "Experience or projects, education, and skills are present." : "Include experience or projects, education, and skills sections." });
  const undated = resume.experience.filter((entry) => !entry.startDate && !entry.endDate && !entry.current);
  checks.push({ id: "dates", ok: undated.length === 0, label: "Dates on every role", detail: undated.length ? `${undated.length} role${undated.length === 1 ? " has" : "s have"} no dates: ${undated.map((entry) => entry.title || entry.employer).join(", ")}.` : "Each role shows a date range." });
  const empty = resume.experience.filter((entry) => entry.bullets.filter((bullet) => bullet.trim()).length === 0);
  checks.push({ id: "bullets", ok: empty.length === 0, label: "Achievements listed", detail: empty.length ? `Add achievement bullets for ${empty.map((entry) => entry.title || entry.employer).join(", ")}.` : "Every role has at least one achievement bullet." });
  const long = [...resume.experience, ...resume.projects].flatMap((entry) => entry.bullets).filter((bullet) => words(bullet) > 40);
  checks.push({ id: "long-bullets", ok: long.length === 0, label: "Concise bullets", detail: long.length ? `${long.length} bullet${long.length === 1 ? " is" : "s are"} over 40 words. Shorter bullets are easier to scan.` : "Bullets are 40 words or fewer." });
  const summaryWords = words(resume.summary);
  checks.push({ id: "summary", ok: summaryWords === 0 || summaryWords <= 80, label: "Summary length", detail: summaryWords > 80 ? `Summary is ${summaryWords} words. Aim for about 30–60.` : summaryWords ? `Summary is ${summaryWords} words.` : "No summary (optional)." });
  checks.push({ id: "font", ok: settings.fontSize >= 10, label: "Readable text size", detail: `Body text is ${settings.fontSize} pt.` });
  const fitsPreference = settings.pagePreference === "multi" || pageCount <= 1;
  checks.push({
    id: "length",
    ok: fitsPreference,
    label: "Page length",
    detail: fitsPreference ? `${pageCount} page${pageCount === 1 ? "" : "s"}.` : `Content runs to ${pageCount} pages. Text is not shrunk automatically; trim older or less relevant content, or tighten margins slightly.`,
  });
  return checks;
}
