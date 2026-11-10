import { effectiveOrder } from "../model/defaults";
import type { DocumentSettings, Resume } from "../model/types";
import { sectionTitle } from "./blocks";

const range = (start: string, end: string) => [start, end].filter(Boolean).join(" – ");
const line = (...parts: string[]) => parts.filter((part) => part && part.trim()).join(" | ");

/** Plain-text résumé in the same section order as the document, for pasting into application forms. */
export function exportPlainText(resume: Resume, settings: DocumentSettings): string {
  const out: string[] = [];
  const { contact } = resume;
  if (contact.name) out.push(contact.name);
  if (contact.headline) out.push(contact.headline);
  const details = line(contact.location, contact.phone, contact.email, contact.linkedin, contact.github, contact.website, ...contact.other);
  if (details) out.push(details);
  const section = (title: string, body: string[]) => {
    if (!body.length) return;
    out.push("", title.toUpperCase(), ...body);
  };
  for (const key of effectiveOrder(resume, settings)) {
    const title = sectionTitle(key, resume);
    switch (key) {
      case "summary":
        section(title, resume.summary.trim() ? [resume.summary.trim()] : []);
        break;
      case "skills":
        section(title, resume.skills.filter((category) => category.skills.length).map((category) => (category.name ? `${category.name}: ${category.skills.join(", ")}` : category.skills.join(", "))));
        break;
      case "experience":
        section(title, resume.experience.flatMap((entry, index) => [...(index ? [""] : []), line(entry.title, entry.employer, entry.location, range(entry.startDate, entry.current ? "Present" : entry.endDate)), ...entry.bullets.filter(Boolean).map((bullet) => `• ${bullet}`)]));
        break;
      case "projects":
        section(title, resume.projects.flatMap((entry, index) => [...(index ? [""] : []), line(entry.name, entry.role, entry.technologies.join(", "), range(entry.startDate, entry.endDate)), ...[entry.githubUrl, entry.liveUrl].filter(Boolean), ...(entry.description ? [entry.description] : []), ...entry.bullets.filter(Boolean).map((bullet) => `• ${bullet}`)]));
        break;
      case "education":
        section(title, resume.education.flatMap((entry) => [line(entry.institution, [entry.degree, entry.field].filter(Boolean).join(", "), entry.location, range(entry.startDate, entry.endDate), entry.gpa && `GPA ${entry.gpa}`), ...entry.details.filter(Boolean).map((detail) => `• ${detail}`)]));
        break;
      case "certifications":
        section(title, resume.certifications.map((cert) => line(cert.name, cert.issuer, cert.date, cert.credentialId && `Credential ID ${cert.credentialId}`)));
        break;
      case "awards":
      case "publications":
        section(title, resume[key].filter((item) => item.text.trim()).map((item) => `• ${item.text}`));
        break;
      default: {
        const custom = resume.custom.find((item) => `custom:${item.id}` === key);
        if (custom) section(title, custom.items.filter((item) => item.text.trim()).map((item) => `• ${item.text}`));
      }
    }
  }
  return out.join("\n").trim() + "\n";
}
