import { extractRequirements } from "../resume/job/extractRequirements";
import type { Difficulty, InterviewType, Level } from "./model";

export type Question = { id: string; text: string; type: InterviewType; expectsStar: boolean; keywords: string[] };

type BankItem = [text: string, difficulty: Difficulty | "any", star?: boolean];

const BANKS: Record<Exclude<InterviewType, "job">, BankItem[]> = {
  behavioral: [
    ["Tell me about a project you are proud of.", "intro", true],
    ["Describe a time you changed your approach after feedback.", "standard", true],
    ["Tell me about a challenge you faced and how you handled it.", "intro", true],
    ["Describe a time you made a mistake. What did you do next?", "standard", true],
    ["Tell me about a time you had to learn something quickly.", "intro", true],
    ["Describe a disagreement with a teammate and how it was resolved.", "challenging", true],
    ["Tell me about a time you had several deadlines at once.", "standard", true],
    ["Describe a time you went beyond what was asked.", "challenging", true],
  ],
  technical: [
    ["Walk me through how you would troubleshoot a problem you cannot reproduce.", "standard"],
    ["Explain a technical decision you made and the trade-offs you considered.", "challenging"],
    ["How do you test a change before you release it?", "intro"],
    ["Explain a technical concept you know well to someone non-technical.", "intro"],
    ["Describe how you would investigate a system that suddenly became slow.", "challenging"],
    ["What happens, step by step, when you type a web address into a browser?", "standard"],
    ["How do you keep your technical skills current?", "intro"],
    ["Tell me about a bug that was hard to find. How did you find it?", "standard", true],
  ],
  hr: [
    ["Tell me about yourself.", "intro"],
    ["Why are you interested in this role?", "intro"],
    ["What kind of team environment helps you do your best work?", "intro"],
    ["Where would you like your career to be in a few years?", "standard"],
    ["What are you looking for in your next position?", "standard"],
    ["Why are you leaving, or why did you leave, your most recent role?", "challenging"],
    ["What questions do you have for us?", "intro"],
  ],
  leadership: [
    ["Tell me about a time you led a group toward a goal.", "intro", true],
    ["Describe a time you had to motivate someone who was struggling.", "standard", true],
    ["Tell me about a decision you made without full information.", "challenging", true],
    ["Describe how you handled a conflict between people you worked with.", "standard", true],
    ["Tell me about a time you delegated work. How did it go?", "standard", true],
    ["Describe a time you had to deliver difficult news.", "challenging", true],
  ],
  scenario: [
    ["A user reports that an important system is down right before a deadline. What do you do in the first 15 minutes?", "standard", true],
    ["You notice a teammate's change may have introduced a security risk. How do you handle it?", "challenging", true],
    ["Your manager gives you two urgent tasks that cannot both finish today. What do you do?", "intro", true],
    ["A customer is frustrated and you do not know the answer to their question. How do you respond?", "intro", true],
    ["You are asked to deliver a project with half the expected time. How do you approach it?", "challenging", true],
    ["You discover the documentation for a process is out of date while following it. What do you do?", "standard", true],
  ],
};

const STOP = new Set(["tell", "about", "time", "describe", "what", "your", "with", "would", "how", "you", "did", "the", "and", "for", "that", "this", "when", "had", "made", "someone", "something"]);
const keywordsOf = (text: string) => [...new Set(text.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((word) => word.length > 3 && !STOP.has(word)))];

/** Small deterministic PRNG so a session's questions can be reproduced. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const char of seed) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function jobQuestions(description: string, title: string): Question[] {
  const { requirements } = extractRequirements(description);
  const role = title.trim() || "this role";
  const questions: Question[] = [];
  const required = requirements.filter((item) => item.kind === "required" && !["Education", "Experience", "Responsibilities", "Other technical terms"].includes(item.category));
  const responsibilities = requirements.filter((item) => item.category === "Responsibilities");
  required.slice(0, 4).forEach((item, index) =>
    questions.push(
      index % 2 === 0
        ? { id: `job-skill-${item.term}`, text: `This ${role} position asks for ${item.term}. Tell me about a time you used it.`, type: "job", expectsStar: true, keywords: [item.term.toLowerCase()] }
        : { id: `job-explain-${item.term}`, text: `How would you explain ${item.term} and how you have applied it to someone outside your field?`, type: "job", expectsStar: false, keywords: [item.term.toLowerCase()] },
    ),
  );
  responsibilities.slice(0, 3).forEach((item) =>
    questions.push({ id: `job-resp-${item.id}`, text: `The role includes: “${item.term}.” Describe experience that prepares you for this.`, type: "job", expectsStar: true, keywords: keywordsOf(item.term) }),
  );
  questions.push({ id: "job-why", text: `Why are you a strong fit for ${role}?`, type: "job", expectsStar: false, keywords: keywordsOf(role) });
  return questions;
}

export function pickQuestions(type: InterviewType, difficulty: Difficulty, level: Level, count: number, seed: string, jobDescription = "", jobTitle = ""): Question[] {
  if (type === "job") {
    const generated = jobDescription.trim() ? jobQuestions(jobDescription, jobTitle) : [];
    const fill = pickQuestions("behavioral", difficulty, level, count, seed);
    return [...generated, ...fill].slice(0, count);
  }
  // Senior candidates get the next difficulty up; entry-level keeps the chosen one.
  if (level === "senior") difficulty = difficulty === "intro" ? "standard" : "challenging";
  const random = seeded(`${seed}:${type}:${difficulty}`);
  const rank = (item: BankItem) => (item[1] === difficulty || item[1] === "any" ? 0 : difficulty === "challenging" && item[1] === "standard" ? 1 : difficulty === "intro" && item[1] === "standard" ? 1 : 2);
  const bank = BANKS[type]
    .map((item) => ({ item, order: rank(item) + random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);
  return bank.slice(0, count).map(([text, , star], index) => ({
    id: `${type}-${index}-${text.slice(0, 24)}`,
    text,
    type,
    expectsStar: Boolean(star) || type === "behavioral" || type === "leadership",
    keywords: keywordsOf(text),
  }));
}
