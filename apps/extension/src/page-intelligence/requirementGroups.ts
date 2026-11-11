import type { PageRequirement } from "../../../../packages/careeros-shared/types";

/**
 * Presents what was found in a job description the way a person reads a posting: qualifications
 * that are required, qualifications that are preferred, the work itself, the tools involved,
 * education, and experience. Each item keeps its normalized label and, separately, the original
 * wording from the posting as evidence. Nothing is appended to a label.
 */

export type RequirementGroupId = "required" | "preferred" | "responsibilities" | "tools" | "education" | "experience" | "check";

export interface GroupedItem {
  /** A short, readable name ("Linux", "2+ years: IT support"). For responsibilities, the posting's own sentence. */
  label: string;
  /** The original wording from the posting. Empty when it would only repeat the label. */
  evidence: string;
  /** Only used where one list mixes importance (tools, education, experience). */
  importance: "required" | "preferred" | "mentioned" | null;
  category: string;
}

export interface RequirementGroup {
  id: RequirementGroupId;
  title: string;
  items: GroupedItem[];
}

const TOOL_CATEGORIES = new Set(["Programming Languages", "Frameworks & Libraries", "Cloud Platforms", "Operating Systems", "Networking", "Security", "Databases", "DevOps & CI/CD", "Data & Analytics", "IT Support & Systems"]);

const TITLES: Record<RequirementGroupId, string> = {
  required: "Required qualifications",
  preferred: "Preferred qualifications",
  responsibilities: "Responsibilities",
  tools: "Tools and technologies",
  education: "Education",
  experience: "Experience",
  check: "Terms to check",
};

const ORDER: RequirementGroupId[] = ["required", "preferred", "tools", "experience", "education", "responsibilities", "check"];

const importanceOf = (kind: PageRequirement["kind"]): GroupedItem["importance"] => (kind === "required" ? "required" : kind === "preferred" ? "preferred" : "mentioned");
const clean = (text: string) => text.replace(/\s+/g, " ").trim();

export function groupRequirements(requirements: PageRequirement[]): RequirementGroup[] {
  const groups = new Map<RequirementGroupId, GroupedItem[]>();
  const seen = new Set<string>();
  const push = (id: RequirementGroupId, item: GroupedItem) => {
    const key = `${id}:${item.label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    groups.set(id, [...(groups.get(id) ?? []), item]);
  };

  for (const r of requirements) {
    if (r.kind === "context" && r.category !== "Responsibilities" && !r.uncertain) continue;
    const evidence = clean(r.evidence);
    const label = clean(r.term);
    const item: GroupedItem = { label, evidence: evidence.toLowerCase() === label.toLowerCase() ? "" : evidence, importance: importanceOf(r.kind), category: r.category };

    if (r.uncertain) {
      push("check", { ...item, importance: null });
    } else if (r.category === "Responsibilities") {
      // The posting's own sentence is the readable form; the shortened term is only a fallback.
      push("responsibilities", { label: evidence || label, evidence: "", importance: null, category: r.category });
    } else if (r.category === "Education") {
      push("education", item);
    } else if (r.category === "Experience") {
      push("experience", item);
    } else if (TOOL_CATEGORIES.has(r.category)) {
      push("tools", item);
    } else if (r.kind === "preferred") {
      push("preferred", { ...item, importance: null });
    } else if (r.kind === "required") {
      push("required", { ...item, importance: null });
    }
    // A skill that only appears inside a duty ("document fixes…" -> Technical documentation) is
    // already visible in that duty's own sentence, so it is not listed a second time.
  }

  return ORDER.filter((id) => groups.has(id)).map((id) => ({ id, title: TITLES[id], items: groups.get(id)! }));
}
