import { Plus } from "lucide-react";
import { uid } from "../model/defaults";
import type { CertificationEntry, EducationEntry, ExperienceEntry, ProjectEntry, Resume, SimpleItem } from "../model/types";
import { dedupeSkills } from "../parse/parseResume";
import { AreaField, BulletEditor, Check, EntryCard, Field, ListField, RowActions, move } from "./fields";

export type EditorSection = "contact" | "summary" | "skills" | "experience" | "projects" | "education" | "certifications" | "awards" | "publications" | "custom";

export const EDITOR_SECTIONS: { key: EditorSection; label: string }[] = [
  { key: "contact", label: "Contact" },
  { key: "summary", label: "Summary" },
  { key: "skills", label: "Skills" },
  { key: "experience", label: "Experience" },
  { key: "projects", label: "Projects" },
  { key: "education", label: "Education" },
  { key: "certifications", label: "Certifications" },
  { key: "awards", label: "Awards" },
  { key: "publications", label: "Publications" },
  { key: "custom", label: "Other sections" },
];

type Props = { resume: Resume; onChange: (resume: Resume) => void; section: EditorSection };

/** Generic helpers for arrays of entries with ids. */
function useListOps<T extends { id: string }>(items: T[], set: (items: T[]) => void) {
  return {
    update: (id: string, change: Partial<T>) => set(items.map((item) => (item.id === id ? { ...item, ...change } : item))),
    remove: (id: string) => set(items.filter((item) => item.id !== id)),
    shift: (index: number, delta: number) => set(move(items, index, delta)),
  };
}

function SimpleItems({ label, items, onChange }: { label: string; items: SimpleItem[]; onChange: (items: SimpleItem[]) => void }) {
  return (
    <BulletEditor
      label={label}
      items={items.map((item) => item.text)}
      addLabel={`Add ${label.toLowerCase().replace(/s$/, "")}`}
      onChange={(texts) => onChange(texts.map((text, index) => ({ id: items[index]?.id ?? uid(), text })))}
    />
  );
}

export default function ResumeEditor({ resume, onChange, section }: Props) {
  const set = <K extends keyof Resume>(key: K, value: Resume[K]) => onChange({ ...resume, [key]: value });
  const experience = useListOps(resume.experience, (items) => set("experience", items));
  const projects = useListOps(resume.projects, (items) => set("projects", items));
  const education = useListOps(resume.education, (items) => set("education", items));
  const certifications = useListOps(resume.certifications, (items) => set("certifications", items));
  const custom = useListOps(resume.custom, (items) => set("custom", items));
  const contact = resume.contact;
  const setContact = (change: Partial<Resume["contact"]>) => set("contact", { ...contact, ...change });

  switch (section) {
    case "contact":
      return (
        <div className="rs-editor-grid">
          <Field label="Full name" value={contact.name} onChange={(name) => setContact({ name })} />
          <Field label="Headline" value={contact.headline} onChange={(headline) => setContact({ headline })} placeholder="e.g. IT Support Specialist" />
          <Field label="Email" type="email" value={contact.email} onChange={(email) => setContact({ email })} />
          <Field label="Phone" type="tel" value={contact.phone} onChange={(phone) => setContact({ phone })} />
          <Field label="Location" value={contact.location} onChange={(location) => setContact({ location })} placeholder="City, ST" />
          <Field label="LinkedIn" value={contact.linkedin} onChange={(linkedin) => setContact({ linkedin })} placeholder="linkedin.com/in/…" />
          <Field label="GitHub" value={contact.github} onChange={(github) => setContact({ github })} placeholder="github.com/…" />
          <Field label="Website" value={contact.website} onChange={(website) => setContact({ website })} />
          <ListField label="Other links" values={contact.other} onChange={(other) => setContact({ other })} />
        </div>
      );
    case "summary":
      return (
        <div className="rs-editor-grid">
          <Field label="Target role" value={resume.targetRole} onChange={(targetRole) => set("targetRole", targetRole)} hint="Used for tailoring. It is not printed on the résumé." />
          <AreaField label="Professional summary" rows={6} value={resume.summary} onChange={(summary) => set("summary", summary)} placeholder="Two to three sentences about your experience and focus." />
        </div>
      );
    case "skills":
      return (
        <div className="rs-editor-grid">
          {resume.skills.map((category, index) => (
            <div className="rs-skill-category" key={category.id}>
              <div className="rs-entry-toolbar">
                <Field label="Category name" value={category.name} onChange={(name) => set("skills", resume.skills.map((item) => (item.id === category.id ? { ...item, name } : item)))} />
                <RowActions label={`category ${category.name || index + 1}`} index={index} count={resume.skills.length} onMove={(delta) => set("skills", move(resume.skills, index, delta))} onRemove={() => set("skills", resume.skills.filter((item) => item.id !== category.id))} />
              </div>
              <ListField
                label={`Skills in ${category.name || "this category"}`}
                values={category.skills}
                onChange={(skills) => set("skills", dedupeSkills(resume.skills.map((item) => (item.id === category.id ? { ...item, skills } : item))).categories)}
              />
            </div>
          ))}
          <button type="button" className="rs-add" onClick={() => set("skills", [...resume.skills, { id: uid(), name: "New category", skills: [] }])}>
            <Plus size={14} /> Add skill category
          </button>
        </div>
      );
    case "experience":
      return (
        <div className="rs-editor-grid">
          {resume.experience.map((entry, index) => (
            <EntryCard key={entry.id} title={<span>{entry.title || "Untitled role"}<small>{entry.employer}</small></span>}>
              <div className="rs-two">
                <Field label="Job title" value={entry.title} onChange={(title) => experience.update(entry.id, { title })} />
                <Field label="Employer" value={entry.employer} onChange={(employer) => experience.update(entry.id, { employer })} />
                <Field label="Location" value={entry.location} onChange={(location) => experience.update(entry.id, { location })} />
                <Field label="Start date" value={entry.startDate} onChange={(startDate) => experience.update(entry.id, { startDate })} placeholder="Jan 2022" />
                <Field label="End date" value={entry.current ? "Present" : entry.endDate} onChange={(endDate) => experience.update(entry.id, { endDate })} placeholder="Dec 2023" />
                <Check label="I currently work here" checked={entry.current} onChange={(current) => experience.update(entry.id, { current, endDate: current ? "Present" : entry.endDate === "Present" ? "" : entry.endDate })} />
              </div>
              <BulletEditor label="Achievements" items={entry.bullets} onChange={(bullets) => experience.update(entry.id, { bullets })} />
              <RowActions label={`role ${entry.title || index + 1}`} index={index} count={resume.experience.length} onMove={(delta) => experience.shift(index, delta)} onRemove={() => experience.remove(entry.id)} />
            </EntryCard>
          ))}
          <button type="button" className="rs-add" onClick={() => set("experience", [...resume.experience, { id: uid(), title: "", employer: "", location: "", startDate: "", endDate: "", current: false, bullets: [] } satisfies ExperienceEntry])}>
            <Plus size={14} /> Add experience
          </button>
        </div>
      );
    case "projects":
      return (
        <div className="rs-editor-grid">
          {resume.projects.map((entry, index) => (
            <EntryCard key={entry.id} title={<span>{entry.name || "Untitled project"}<small>{entry.technologies.slice(0, 3).join(", ")}</small></span>}>
              <div className="rs-two">
                <Field label="Project name" value={entry.name} onChange={(name) => projects.update(entry.id, { name })} />
                <Field label="Your role" value={entry.role} onChange={(role) => projects.update(entry.id, { role })} />
                <Field label="Start date" value={entry.startDate} onChange={(startDate) => projects.update(entry.id, { startDate })} />
                <Field label="End date" value={entry.endDate} onChange={(endDate) => projects.update(entry.id, { endDate })} />
                <Field label="GitHub URL" value={entry.githubUrl} onChange={(githubUrl) => projects.update(entry.id, { githubUrl })} />
                <Field label="Live demo URL" value={entry.liveUrl} onChange={(liveUrl) => projects.update(entry.id, { liveUrl })} />
              </div>
              <ListField label="Technologies" values={entry.technologies} onChange={(technologies) => projects.update(entry.id, { technologies })} />
              <AreaField label="Description" value={entry.description} onChange={(description) => projects.update(entry.id, { description })} />
              <BulletEditor label="Achievements" items={entry.bullets} onChange={(bullets) => projects.update(entry.id, { bullets })} />
              <RowActions label={`project ${entry.name || index + 1}`} index={index} count={resume.projects.length} onMove={(delta) => projects.shift(index, delta)} onRemove={() => projects.remove(entry.id)} />
            </EntryCard>
          ))}
          <button type="button" className="rs-add" onClick={() => set("projects", [...resume.projects, { id: uid(), name: "", description: "", technologies: [], role: "", startDate: "", endDate: "", bullets: [], githubUrl: "", liveUrl: "" } satisfies ProjectEntry])}>
            <Plus size={14} /> Add project
          </button>
        </div>
      );
    case "education":
      return (
        <div className="rs-editor-grid">
          {resume.education.map((entry, index) => (
            <EntryCard key={entry.id} title={<span>{entry.institution || "Untitled school"}<small>{entry.degree}</small></span>}>
              <div className="rs-two">
                <Field label="Institution" value={entry.institution} onChange={(institution) => education.update(entry.id, { institution })} />
                <Field label="Degree" value={entry.degree} onChange={(degree) => education.update(entry.id, { degree })} />
                <Field label="Field of study" value={entry.field} onChange={(field) => education.update(entry.id, { field })} />
                <Field label="Location" value={entry.location} onChange={(location) => education.update(entry.id, { location })} />
                <Field label="Start date" value={entry.startDate} onChange={(startDate) => education.update(entry.id, { startDate })} />
                <Field label="End or graduation date" value={entry.endDate} onChange={(endDate) => education.update(entry.id, { endDate })} />
                <Field label="GPA (optional)" value={entry.gpa} onChange={(gpa) => education.update(entry.id, { gpa })} />
              </div>
              <BulletEditor label="Details" items={entry.details} addLabel="Add detail" onChange={(details) => education.update(entry.id, { details })} />
              <RowActions label={`education ${entry.institution || index + 1}`} index={index} count={resume.education.length} onMove={(delta) => education.shift(index, delta)} onRemove={() => education.remove(entry.id)} />
            </EntryCard>
          ))}
          <button type="button" className="rs-add" onClick={() => set("education", [...resume.education, { id: uid(), institution: "", degree: "", field: "", location: "", startDate: "", endDate: "", gpa: "", details: [] } satisfies EducationEntry])}>
            <Plus size={14} /> Add education
          </button>
        </div>
      );
    case "certifications":
      return (
        <div className="rs-editor-grid">
          {resume.certifications.map((cert, index) => (
            <EntryCard key={cert.id} title={<span>{cert.name || "Untitled certification"}<small>{cert.issuer}</small></span>}>
              <div className="rs-two">
                <Field label="Certification" value={cert.name} onChange={(name) => certifications.update(cert.id, { name })} />
                <Field label="Issuer" value={cert.issuer} onChange={(issuer) => certifications.update(cert.id, { issuer })} />
                <Field label="Date" value={cert.date} onChange={(date) => certifications.update(cert.id, { date })} />
                <Field label="Credential ID" value={cert.credentialId} onChange={(credentialId) => certifications.update(cert.id, { credentialId })} />
              </div>
              <RowActions label={`certification ${cert.name || index + 1}`} index={index} count={resume.certifications.length} onMove={(delta) => certifications.shift(index, delta)} onRemove={() => certifications.remove(cert.id)} />
            </EntryCard>
          ))}
          <button type="button" className="rs-add" onClick={() => set("certifications", [...resume.certifications, { id: uid(), name: "", issuer: "", date: "", credentialId: "" } satisfies CertificationEntry])}>
            <Plus size={14} /> Add certification
          </button>
        </div>
      );
    case "awards":
      return <SimpleItems label="Awards" items={resume.awards} onChange={(items) => set("awards", items)} />;
    case "publications":
      return <SimpleItems label="Publications" items={resume.publications} onChange={(items) => set("publications", items)} />;
    case "custom":
      return (
        <div className="rs-editor-grid">
          {resume.custom.map((section, index) => (
            <EntryCard key={section.id} defaultOpen title={<span>{section.title || "Untitled section"}<small>{section.items.length} items</small></span>}>
              <Field label="Section title" value={section.title} onChange={(title) => custom.update(section.id, { title })} />
              <SimpleItems label="Items" items={section.items} onChange={(items) => custom.update(section.id, { items })} />
              <RowActions label={`section ${section.title || index + 1}`} index={index} count={resume.custom.length} onMove={(delta) => custom.shift(index, delta)} onRemove={() => custom.remove(section.id)} />
            </EntryCard>
          ))}
          <button type="button" className="rs-add" onClick={() => set("custom", [...resume.custom, { id: uid(), title: "New section", items: [] }])}>
            <Plus size={14} /> Add section
          </button>
        </div>
      );
  }
}
