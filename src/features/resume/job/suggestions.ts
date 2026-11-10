import { uid } from "../model/defaults";
import type { DocumentSettings, Resume, SectionKey } from "../model/types";
import { effectiveOrder } from "../model/defaults";
import type { MatchResult, RequirementMatch } from "./match";
import { taxonomyCategory, termRegex } from "./taxonomy";

/**
 * Rule-based résumé suggestions. Each one shows the current text, the proposed
 * text, why, and what it is based on. Nothing is applied without approval.
 *
 * Integrity rules:
 *  - Skills or certifications are only proposed when the user confirmed
 *    "I have this" for the requirement.
 *  - Suggestions that would need facts the résumé does not contain use
 *    [bracketed placeholders] and cannot be applied until the user replaces them.
 *  - Missing qualifications produce advice, never résumé text.
 */

export type SuggestionKind =
  | "add-skill"
  | "add-certification"
  | "strengthen"
  | "explain-missing"
  | "action-verb"
  | "split-bullet"
  | "reduce-repetition"
  | "tailor-summary"
  | "highlight-project"
  | "reorder-sections";

export type Suggestion = {
  /** Stable key so a rejected suggestion stays hidden. */
  key: string;
  kind: SuggestionKind;
  title: string;
  current: string;
  proposed: string;
  explanation: string;
  evidence: string;
  /** Advisory suggestions have no apply step. */
  apply?: (text: string, resume: Resume, settings: DocumentSettings) => { resume?: Resume; settings?: DocumentSettings };
};

export const KIND_LABELS: Record<SuggestionKind, string> = {
  "add-skill": "Add verified skill",
  "add-certification": "Add verified certification",
  strengthen: "Improve achievement bullet",
  "explain-missing": "Explain missing qualification",
  "action-verb": "Increase clarity",
  "split-bullet": "Improve readability",
  "reduce-repetition": "Reduce repetition",
  "tailor-summary": "Tailor professional summary",
  "highlight-project": "Highlight relevant project",
  "reorder-sections": "Reorder sections",
};

export const hasPlaceholder = (text: string) => /\[[^\]]+\]/.test(text);

const WEAK_OPENER = /^(responsible for|duties included|worked on|helped(?: with| to)?|assisted(?: with| in)?|tasked with|in charge of)\s+/i;
const IRREGULAR: Record<string, string> = { running: "Ran", building: "Built", leading: "Led", writing: "Wrote", setting: "Set", making: "Made", troubleshooting: "Troubleshot", teaching: "Taught", getting: "Got", keeping: "Kept", sending: "Sent", meeting: "Met", planning: "Planned", shipping: "Shipped", spending: "Spent", choosing: "Chose", finding: "Found", holding: "Held", bringing: "Brought", buying: "Bought", selling: "Sold" };

/** "Responsible for managing the help desk" → "Managed the help desk". Returns null when unsure. */
export function toActionVerb(bullet: string): string | null {
  const match = bullet.match(WEAK_OPENER);
  if (!match) return null;
  const rest = bullet.slice(match[0].length);
  const [first, ...others] = rest.split(/\s+/);
  const word = first.toLowerCase().replace(/[^a-z]/g, "");
  if (!word.endsWith("ing") || word.length < 5) return null;
  let verb = IRREGULAR[word];
  if (!verb) {
    const stem = word.slice(0, -3);
    if (/([bcdfghjklmnpqrstvwxz])\1$/.test(stem)) return null;
    verb = /[^aeiou]y$/.test(stem) ? `${stem.slice(0, -1)}ied` : stem.endsWith("e") ? `${stem}d` : `${stem}ed`;
    verb = verb.charAt(0).toUpperCase() + verb.slice(1);
  }
  return [verb, ...others].join(" ");
}

function skillCategoryFor(resume: Resume, term: string) {
  const taxonomy = taxonomyCategory(term) ?? "Skills";
  const words = taxonomy.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 3);
  return resume.skills.find((category) => words.some((word) => category.name.toLowerCase().includes(word))) ?? null;
}

const inSkills = (resume: Resume, term: string) => resume.skills.some((category) => category.skills.some((skill) => skill.toLowerCase() === term.toLowerCase()));

function matchedTermsBy(result: MatchResult, section: "Experience" | "Projects") {
  return result.matches.filter((match) => match.status === "demonstrated" && match.evidence.some((item) => item.section === section));
}

export function buildSuggestions(resume: Resume, settings: DocumentSettings, result: MatchResult): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const relevant = (match: RequirementMatch) => match.requirement.kind !== "context";

  for (const match of result.matches.filter(relevant)) {
    const { requirement } = match;
    if (requirement.category === "Responsibilities" || requirement.category === "Experience" || requirement.category === "Education") {
      if (requirement.possession === "not" && requirement.kind === "required")
        suggestions.push({ key: `missing:${requirement.term}`, kind: "explain-missing", title: requirement.term, current: "Not shown on your résumé.", proposed: "No résumé change.", explanation: "You indicated you don't meet this yet. Don't claim it. If the posting allows equivalent experience, say so in a cover letter, or build toward it with a course or project.", evidence: "Your answer: I don't have this" });
      continue;
    }

    if (requirement.possession === "has" && match.status === "missing") {
      if (requirement.category === "Certifications") {
        suggestions.push({
          key: `cert:${requirement.term}`,
          kind: "add-certification",
          title: requirement.term,
          current: resume.certifications.length ? resume.certifications.map((cert) => cert.name).join(", ") : "No certifications listed.",
          proposed: requirement.term,
          explanation: "You confirmed you hold this certification. Add the issuer and date in the editor afterwards.",
          evidence: "Your answer: I have this",
          apply: (text, current) => ({ resume: { ...current, certifications: [...current.certifications, { id: uid(), name: text.trim(), issuer: "", date: "", credentialId: "" }] } }),
        });
      } else if (!inSkills(resume, requirement.term)) {
        const category = skillCategoryFor(resume, requirement.term);
        const categoryName = category?.name ?? taxonomyCategory(requirement.term) ?? "Skills";
        suggestions.push({
          key: `skill:${requirement.term}`,
          kind: "add-skill",
          title: requirement.term,
          current: category ? `${category.name}: ${category.skills.join(", ")}` : `No “${categoryName}” category yet.`,
          proposed: requirement.term,
          explanation: `You confirmed you have this. It will be added to “${categoryName}”. A skills entry is weaker evidence than an example in your experience, so consider adding one too.`,
          evidence: "Your answer: I have this",
          apply: (text, current) => {
            const term = text.trim();
            const existing = current.skills.find((item) => item.name === categoryName);
            const skills = existing
              ? current.skills.map((item) => (item.id === existing.id ? { ...item, skills: [...item.skills, term] } : item))
              : [...current.skills, { id: uid(), name: categoryName, skills: [term] }];
            return { resume: { ...current, skills } };
          },
        });
      }
    }

    if (requirement.possession === "has" && (match.status === "mentioned" || match.status === "missing") && requirement.category !== "Certifications") {
      const role = resume.experience[0];
      const project = resume.projects[0];
      const target = role ? { kind: "experience" as const, id: role.id, label: [role.title, role.employer].filter(Boolean).join(", ") } : project ? { kind: "projects" as const, id: project.id, label: project.name } : null;
      if (target)
        suggestions.push({
          key: `strengthen:${requirement.term}`,
          kind: "strengthen",
          title: requirement.term,
          current: match.status === "mentioned" ? match.evidence.map((item) => item.text).join(" / ") : "Not described in your experience.",
          proposed: `Used ${requirement.term} to [what you did] for [who or what], resulting in [outcome].`,
          explanation: `Employers look for examples of use. Replace every [bracketed] part with what actually happened; this bullet will be added to ${target.label}. It cannot be applied while placeholders remain.`,
          evidence: "Your answer: I have this",
          apply: (text, current) => ({
            resume:
              target.kind === "experience"
                ? { ...current, experience: current.experience.map((entry) => (entry.id === target.id ? { ...entry, bullets: [...entry.bullets, text.trim()] } : entry)) }
                : { ...current, projects: current.projects.map((entry) => (entry.id === target.id ? { ...entry, bullets: [...entry.bullets, text.trim()] } : entry)) },
          }),
        });
    }

    if (requirement.possession === "not" && (requirement.kind === "required" || requirement.kind === "preferred") && match.status === "missing")
      suggestions.push({
        key: `missing:${requirement.term}`,
        kind: "explain-missing",
        title: requirement.term,
        current: "Not shown on your résumé.",
        proposed: "No résumé change.",
        explanation: `The posting lists ${requirement.term} as ${requirement.kind}. Don't add it. Options: learn it through a course or the Learning Academy, build a small project that uses it, or mention related experience in your cover letter.`,
        evidence: "Your answer: I don't have this",
      });
  }

  // Clarity: weak openers → action verbs (meaning unchanged).
  for (const [section, entries] of [["experience", resume.experience], ["projects", resume.projects]] as const) {
    for (const entry of entries) {
      entry.bullets.forEach((bullet, index) => {
        const rewritten = toActionVerb(bullet);
        if (rewritten)
          suggestions.push({
            key: `verb:${entry.id}:${bullet}`,
            kind: "action-verb",
            title: "title" in entry ? entry.title || entry.employer : entry.name,
            current: bullet,
            proposed: rewritten,
            explanation: "Starting with an action verb is clearer and shorter. The meaning is unchanged; edit if the verb is not quite right.",
            evidence: `${section === "experience" ? "Experience" : "Projects"} bullet ${index + 1}`,
            apply: (text, current) => ({ resume: replaceBullet(current, section, entry.id, bullet, [text.trim()]) }),
          });
        const words = bullet.trim().split(/\s+/).length;
        if (words > 40 && bullet.includes("; ")) {
          const parts = bullet.split(/;\s+/).map((part) => part.trim().replace(/^./, (char) => char.toUpperCase())).filter(Boolean);
          suggestions.push({
            key: `split:${entry.id}:${bullet}`,
            kind: "split-bullet",
            title: "title" in entry ? entry.title || entry.employer : entry.name,
            current: bullet,
            proposed: parts.join("\n"),
            explanation: `This bullet is ${words} words. Splitting it at the semicolons makes each point easier to scan. One bullet per line.`,
            evidence: `${section === "experience" ? "Experience" : "Projects"} bullet ${index + 1}`,
            apply: (text, current) => ({ resume: replaceBullet(current, section, entry.id, bullet, text.split("\n").map((line) => line.trim()).filter(Boolean)) }),
          });
        }
      });
      const openers = entry.bullets.map((bullet) => bullet.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
      const repeated = [...new Set(openers)].filter((word) => openers.filter((item) => item === word).length >= 3);
      if (repeated.length)
        suggestions.push({
          key: `repeat:${entry.id}:${repeated.join(",")}`,
          kind: "reduce-repetition",
          title: "title" in entry ? entry.title || entry.employer : entry.name,
          current: entry.bullets.filter((bullet) => repeated.includes(bullet.trim().split(/\s+/)[0]?.toLowerCase())).join("\n"),
          proposed: "Edit these bullets in the editor.",
          explanation: `${repeated.map((word) => `“${word}”`).join(", ")} starts ${openers.filter((word) => repeated.includes(word)).length} bullets here. Varying the verbs helps each accomplishment stand out.`,
          evidence: "Bullet openings in this entry",
        });
    }
  }

  // Tailor the summary with requirements already demonstrated in experience or projects.
  const demonstrated = [...matchedTermsBy(result, "Experience"), ...matchedTermsBy(result, "Projects")]
    .filter((match) => match.requirement.kind === "required" || match.requirement.kind === "preferred")
    .map((match) => match.requirement.term)
    .filter((term, index, list) => list.indexOf(term) === index)
    .filter((term) => !termRegex(term, "").test(resume.summary))
    .slice(0, 3);
  if (demonstrated.length && resume.summary.trim()) {
    const list = demonstrated.length > 1 ? `${demonstrated.slice(0, -1).join(", ")} and ${demonstrated[demonstrated.length - 1]}` : demonstrated[0];
    const sentence = `Hands-on experience with ${list}.`;
    suggestions.push({
      key: `summary:${demonstrated.join(",")}`,
      kind: "tailor-summary",
      title: "Professional summary",
      current: resume.summary,
      proposed: `${resume.summary.trim()} ${sentence}`,
      explanation: "These requirements are already backed by your experience or projects but are not in your summary, which recruiters often read first.",
      evidence: `Demonstrated in your résumé: ${demonstrated.join(", ")}`,
      apply: (text, current) => ({ resume: { ...current, summary: text.trim() } }),
    });
  }

  // Highlight the project with the most matched requirements.
  if (resume.projects.length > 1) {
    const scored = resume.projects.map((project) => ({ project, hits: result.matches.filter((match) => match.status === "demonstrated" && match.evidence.some((item) => item.section === "Projects" && item.label === project.name)).length }));
    const best = [...scored].sort((a, b) => b.hits - a.hits)[0];
    if (best.hits > 0 && best.project.id !== resume.projects[0].id && best.hits > scored[0].hits)
      suggestions.push({
        key: `project:${best.project.id}`,
        kind: "highlight-project",
        title: best.project.name,
        current: `Projects order: ${resume.projects.map((project) => project.name).join(", ")}`,
        proposed: `Move “${best.project.name}” to the top of Projects.`,
        explanation: `It demonstrates ${best.hits} of this posting's requirements, more than the project currently listed first.`,
        evidence: "Requirement matches in Projects",
        apply: (_text, current) => ({ resume: { ...current, projects: [best.project, ...current.projects.filter((project) => project.id !== best.project.id)].map((project) => current.projects.find((item) => item.id === project.id) ?? project) } }),
      });
  }

  // Put projects above experience when projects carry most of the evidence.
  const order = effectiveOrder(resume, settings);
  const projectHits = matchedTermsBy(result, "Projects").length;
  const experienceHits = matchedTermsBy(result, "Experience").length;
  if (projectHits > experienceHits && order.indexOf("projects") > order.indexOf("experience"))
    suggestions.push({
      key: `order:projects-first`,
      kind: "reorder-sections",
      title: "Section order",
      current: order.slice(0, 5).map(labelOf).join(" → "),
      proposed: moveBefore(order, "projects", "experience").slice(0, 5).map(labelOf).join(" → "),
      explanation: `Your projects demonstrate ${projectHits} matched requirements versus ${experienceHits} in experience. Listing them first puts that evidence higher on the page.`,
      evidence: "Requirement matches by section",
      apply: (_text, _current, currentSettings) => ({ settings: { ...currentSettings, sectionOrder: moveBefore(effectiveOrder(resume, currentSettings), "projects", "experience") } }),
    });

  const seen = new Set<string>();
  return suggestions.filter((suggestion) => (seen.has(suggestion.key) ? false : (seen.add(suggestion.key), true)));
}

const labelOf = (key: SectionKey) => (key.startsWith("custom:") ? "Custom" : key.charAt(0).toUpperCase() + key.slice(1));

function moveBefore(order: SectionKey[], key: SectionKey, before: SectionKey): SectionKey[] {
  const without = order.filter((item) => item !== key);
  const index = without.indexOf(before);
  return [...without.slice(0, index), key, ...without.slice(index)];
}

function replaceBullet(resume: Resume, section: "experience" | "projects", entryId: string, original: string, replacement: string[]): Resume {
  const swap = (bullets: string[]) => {
    const index = bullets.indexOf(original);
    return index < 0 ? bullets : [...bullets.slice(0, index), ...replacement, ...bullets.slice(index + 1)];
  };
  return section === "experience"
    ? { ...resume, experience: resume.experience.map((entry) => (entry.id === entryId ? { ...entry, bullets: swap(entry.bullets) } : entry)) }
    : { ...resume, projects: resume.projects.map((entry) => (entry.id === entryId ? { ...entry, bullets: swap(entry.bullets) } : entry)) };
}
