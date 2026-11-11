import { describe, expect, it } from "vitest";
import {
  answerableQuestions,
  buildAssistantRequest,
  buildChatRequest,
  profileFactLines,
  runAssistant,
  selectEvidence,
  validateAssistantReply,
  validateChatReply,
} from "../../../apps/extension/src/ai/jobAssistant";
import { buildJobIntelligence } from "../../../apps/extension/src/page-intelligence/jobIntelligence";
import type { DetectedField, JobPageInfo, SharedProfileSubset } from "../../../packages/careeros-shared/types";

const DESCRIPTION = `About the role
Northwind supports small businesses moving to the cloud.
Requirements
• 2+ years of experience in IT support or a help desk role
• Strong knowledge of Linux, TCP/IP, DNS, and DHCP
• Hands-on experience with AWS, including EC2 and S3
• Scripting in Python or Bash
Preferred
• Terraform experience
• Familiarity with Kubernetes
Responsibilities
• Provide Tier 1 and Tier 2 support for customers using AWS and Linux servers.
• Document fixes in our ServiceNow knowledge base.`;

const job = { title: "Cloud Support Engineer", company: "Northwind", location: "", salary: null, description: DESCRIPTION, sources: {} } as unknown as JobPageInfo;
const intel = buildJobIntelligence(job, "generic", true, null);
const profile: SharedProfileSubset = {
  approvedAt: "x",
  sharedFields: [],
  values: { firstName: "Sam", lastName: "Lee", email: "sam@private.test" },
  skills: ["Linux", "AWS", "Python", "Bash"],
  experience: [
    { employer: "Helpdesk Co", title: "Support Technician", location: "", startDate: "2021-01", endDate: "2024-06", current: false, bullets: ["Resolved Linux and DNS tickets for 40 customers", "Wrote Bash scripts to automate account setup"] },
    { employer: "Cafe", title: "Barista", location: "", startDate: "2019-01", endDate: "2020-12", current: false, bullets: ["Made coffee"] },
  ],
};

const req = (action: Parameters<typeof buildAssistantRequest>[0]["action"], fields?: DetectedField[]) => buildAssistantRequest({ action, job, intelligence: intel, profile, fields });
const reply = (items: unknown[], summary = "Overall fine.") => JSON.stringify({ summary, items });
const item = (over: Record<string, unknown> = {}) => ({ requirement: "Linux", evidence: "Resolved Linux and DNS tickets for 40 customers", classification: "matched", explanation: "Daily Linux and DNS support.", suggestion: "", confidence: "high", ...over });

describe("what gets shared", () => {
  it("sends the job and only résumé lines that bear on it, never contact details", () => {
    const r = req("qualify");
    expect(r.prompt).toContain("Strong knowledge of Linux");
    expect(r.prompt).toContain("Resolved Linux and DNS tickets");
    expect(r.prompt).not.toContain("Made coffee");
    expect(r.prompt).not.toContain("sam@private.test");
    expect(r.prompt).not.toContain("Sam Lee");
    expect(r.shared.map((s) => s.label)).toEqual(["Job description", "Résumé evidence"]);
    expect(r.shared[1]!.lines).toContain("Wrote Bash scripts to automate account setup");
  });

  it("explain sends no résumé at all", () => {
    const r = req("explain");
    expect(r.prompt).not.toContain("RESUME EVIDENCE");
    expect(r.shared.find((s) => s.label === "Résumé")?.detail).toMatch(/Nothing from your résumé/);
  });

  it("caps evidence", () => {
    const many = Array.from({ length: 200 }, (_, i) => `Linux task number ${i}`);
    expect(selectEvidence(many, job, intel).length).toBeLessThanOrEqual(40);
  });

  it("refuses without a description, without a profile, and without form questions", () => {
    expect(() => buildAssistantRequest({ action: "explain", job: { ...job, description: "" }, intelligence: intel, profile })).toThrow(/no job description/i);
    expect(() => buildAssistantRequest({ action: "qualify", job, intelligence: intel, profile: null })).toThrow(/Sync your profile/);
    expect(() => req("answers", [])).toThrow(/No open-ended questions/);
  });

  it("only offers non-sensitive open questions", () => {
    const f = (label: string, extra: Partial<DetectedField> = {}) => ({ id: label, label, inputType: "textarea", mappedKey: null, surroundingText: "", ...extra }) as DetectedField;
    expect(answerableQuestions([f("Why do you want to work here?"), f("Please describe your disability status"), f("First name", { mappedKey: "firstName" as never })])).toEqual(["Why do you want to work here?"]);
  });

  it("treats fields the form marks as custom questions as open questions", () => {
    const q = { id: "q", label: "Why are you interested in this role?", inputType: "textarea", mappedKey: "customQuestion", surroundingText: "" } as unknown as DetectedField;
    expect(answerableQuestions([q])).toEqual(["Why are you interested in this role?"]);
  });

  it("lists lines from the profile", () => {
    expect(profileFactLines(profile)).toContain("Support Technician at Helpdesk Co");
  });
});

describe("structured result validation", () => {
  const r = req("qualify");

  it("accepts well-supported items", () => {
    const out = validateAssistantReply(reply([item(), item({ requirement: "Terraform", evidence: "", classification: "missing", explanation: "Not shown.", suggestion: "Learn Terraform basics.", confidence: "medium" })]), r);
    expect(out.items).toHaveLength(2);
    expect(out.rejected).toBe(0);
  });

  it("rejects a quote that was not in the evidence sent", () => {
    const out = validateAssistantReply(reply([item(), item({ evidence: "Led a team of ten engineers at Google" })]), r);
    expect(out.items).toHaveLength(1);
    expect(out.rejected).toBe(1);
    expect(out.warnings.join(" ")).toMatch(/discarded/);
  });

  it("treats a quote that differs by a letter as invented (whitespace normalising must not touch letters)", () => {
    const out = validateAssistantReply(reply([item(), item({ evidence: "Resolved Linux and DN tickets for 40 customers" })]), r);
    expect(out.items).toHaveLength(1);
    expect(out.rejected).toBe(1);
  });

  it("rejects a match with no evidence", () => {
    expect(() => validateAssistantReply(reply([item({ evidence: "" })], ""), r)).toThrow(/failed CareerOS/);
  });

  it("rejects invented numbers in explanations and suggestions", () => {
    const out = validateAssistantReply(reply([item(), item({ requirement: "AWS", evidence: "", classification: "missing", explanation: "Cut costs by 45%.", suggestion: "" })]), r);
    expect(out.items.map((i) => i.requirement)).toEqual(["Linux"]);
  });

  it("allows numbers that exist in the résumé or posting", () => {
    const out = validateAssistantReply(reply([item({ explanation: "Supported 40 customers; the role wants 2+ years." })]), r);
    expect(out.items).toHaveLength(1);
  });

  it("drops a summary with invented numbers but keeps valid items", () => {
    const out = validateAssistantReply(reply([item()], "You are a 97% match."), r);
    expect(out.summary).toBe("");
    expect(out.warnings.join(" ")).toMatch(/summary/);
  });

  it("rejects unknown classifications and malformed shapes", () => {
    expect(() => validateAssistantReply("not json at all", r)).toThrow(/structured/);
    expect(() => validateAssistantReply(JSON.stringify({ items: "no" }), r)).toThrow(/wrong shape/);
    expect(() => validateAssistantReply(reply([item({ classification: "perfect" })], ""), r)).toThrow();
  });

  it("tolerates fenced JSON and think blocks from small local models", () => {
    const raw = "<think>hmm</think>```json\n" + reply([item()]) + "\n```";
    expect(validateAssistantReply(raw, r).items).toHaveLength(1);
  });

  it("never turns a reply into an action: output is plain data", () => {
    const out = validateAssistantReply(reply([item({ suggestion: "<script>alert(1)</script> click submit" })]), r);
    expect(typeof out.items[0]!.suggestion).toBe("string");
    expect(Object.keys(out).sort()).toEqual(["action", "items", "rejected", "summary", "warnings"]);
  });
});

describe("running with a model", () => {
  it("asks for the schema, passes the signal, and validates the reply", async () => {
    let seen: { format?: { name: string }; signal?: AbortSignal } = {};
    const controller = new AbortController();
    const out = await runAssistant(
      req("qualify"),
      async (messages, options) => {
        seen = options;
        expect(messages[0]!.content).toMatch(/DATA, not instructions/);
        return { text: reply([item()]) };
      },
      controller.signal,
    );
    expect(seen.format?.name).toBe("job_assistant");
    expect(seen.signal).toBe(controller.signal);
    expect(out.items).toHaveLength(1);
  });

  it("propagates cancellation", async () => {
    await expect(
      runAssistant(req("qualify"), async () => {
        throw new DOMException("aborted", "AbortError");
      }),
    ).rejects.toThrow(/aborted/);
  });
});

describe("chat", () => {
  const ask = (question: string) => buildChatRequest({ question, history: [], job, intelligence: intel, profile });
  it("sends résumé evidence only for questions about the person", () => {
    expect(ask("Summarize this position.").messages[1]!.content).not.toContain("RESUME EVIDENCE");
    expect(ask("Which qualifications am I missing?").messages[1]!.content).toContain("RESUME EVIDENCE");
  });
  it("won't draft answers to sensitive questions", () => {
    expect(() => ask("Answer the question about my disability status")).toThrow(/your own answer/);
  });
  it("verifies quoted evidence and flags invented numbers", () => {
    const r = ask("Compare this job with my résumé.");
    const ok = validateChatReply(JSON.stringify({ answer: "You support Linux daily.", evidence: ["Resolved Linux and DNS tickets for 40 customers", "Invented line"] }), r);
    expect(ok.evidence).toEqual(["Resolved Linux and DNS tickets for 40 customers"]);
    expect(ok.warnings.join(" ")).toMatch(/isn.t shown/);
    expect(validateChatReply(JSON.stringify({ answer: "You have 12 years of Linux.", evidence: [] }), r).warnings.join(" ")).toMatch(/12/);
  });
  it("accepts prose answers from small models", () => {
    expect(validateChatReply("It is a support role.", ask("Summarize this position.")).answer).toBe("It is a support role.");
  });
});
