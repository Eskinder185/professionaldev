// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { detectPageContext } from "../../../apps/extension/src/detect/pageContext";
import { findEmbeddedApplicationFrames } from "../../../apps/extension/src/page-intelligence/embeddedFrames";
import { extractJobDescription, structuredText } from "../../../apps/extension/src/page-intelligence/jobDescription";
import { MIN_SCORED_REQUIREMENTS, NOT_ENOUGH_INFO, scoredRequirements } from "../../../apps/extension/src/page-intelligence/jobIntelligence";
import { deepQuery, deepQueryAll } from "../../../packages/careeros-shared/dom/deepQuery";
import { discoverFormFields, executeFormAutofill } from "../../../packages/careeros-shared/adapters";
import type { SharedProfileSubset } from "../../../packages/careeros-shared/types";
import { ARTICLE_PAGE, EMBEDDED_FORM_PAGE, GREENHOUSE_PAGE, INJECTION_JOB, JSON_LD_JOB, THIN_JOB } from "../../fixtures/jobPages";

function load(html: string): Document {
  const doc = document.implementation.createHTMLDocument("");
  doc.documentElement.innerHTML = html.replace(/^<!doctype html>/i, "");
  // jsdom does not run scripts in a detached document; reattach for pages that define components.
  return doc;
}
afterEach(() => {
  document.body.innerHTML = "";
});

const profile: SharedProfileSubset = {
  approvedAt: "2026-01-01T00:00:00.000Z",
  sharedFields: ["firstName", "lastName", "email"],
  values: { firstName: "Jordan", lastName: "Rivera", email: "jordan@example.com" },
};

describe("job detection from structured data", () => {
  const context = detectPageContext(load(JSON_LD_JOB), "https://careers.northwind.example/jobs/4471", null, null);

  it("reads the job exactly as the page states it, with the source of each field", () => {
    expect(context.job).toMatchObject({
      title: "Cloud Support Engineer",
      company: "Northwind Cloud Services",
      location: "Austin, TX, US",
      salary: "$70,000–$90,000 / year",
      employmentType: "Full-time",
      jobId: "REQ-4471",
      applicationUrl: "https://careers.northwind.example/jobs/4471/apply",
    });
    expect(context.job?.sources).toMatchObject({ title: "JSON-LD JobPosting", company: "JSON-LD JobPosting", salary: "JSON-LD baseSalary" });
  });

  it("is highly confident because the site describes the job itself", () => {
    expect(context.intelligence).toMatchObject({ confidence: "high", sufficientForMatch: true, insufficiencyReason: null });
    expect(context.intelligence?.confidenceReasons.join(" ")).toMatch(/structured data/);
  });

  it("finds required, preferred, and responsibility requirements with the sentence each came from", () => {
    const requirements = context.intelligence!.requirements;
    const find = (term: string) => requirements.find((r) => r.term === term);
    expect(find("Linux")).toMatchObject({ kind: "required", category: "Operating Systems" });
    expect(find("Linux")?.evidence).toMatch(/Linux, TCP\/IP, DNS, and DHCP/);
    expect(find("Terraform")).toMatchObject({ kind: "preferred" });
    expect(find("Kubernetes")).toMatchObject({ kind: "preferred" });
    expect(find("ServiceNow")).toMatchObject({ kind: "responsibility" });
    expect(scoredRequirements(context.intelligence!).length).toBeGreaterThanOrEqual(MIN_SCORED_REQUIREMENTS);
  });

  it("keeps the description's headings and bullets, so a structured description still separates required from preferred", () => {
    expect(context.job?.description).toContain("• Hands-on experience with AWS, including EC2 and S3.");
    expect(context.job?.description).toMatch(/Preferred Qualifications\n• Terraform experience is a plus\./);
  });

  it("does not turn the company, city, or salary into skills", () => {
    const terms = context.intelligence!.requirements.map((r) => r.term.toLowerCase());
    for (const notASkill of ["northwind", "austin", "tx", "70000", "usd", "us"]) expect(terms).not.toContain(notASkill);
  });
});

describe("job detection without structured data", () => {
  const context = detectPageContext(load(GREENHOUSE_PAGE), "https://boards.greenhouse.io/northwind/jobs/123", profile, null);

  it("reads the title, company, location, and the description from the page itself", () => {
    expect(context.platform).toBe("greenhouse");
    expect(context.job).toMatchObject({ title: "Cloud Support Engineer", company: "Northwind Cloud Services", location: "Austin, TX" });
    expect(context.job?.sources.description).toMatch(/Greenhouse/);
    expect(context.job?.description).toMatch(/Requirements/);
  });

  it("keeps the description's headings and bullets so requirement types survive", () => {
    expect(context.job?.description).toContain("• Strong knowledge of Linux, TCP/IP, DNS, and DHCP.");
    const aws = context.intelligence!.requirements.find((r) => r.term === "AWS");
    expect(aws?.kind).toBe("required");
  });

  it("does not invent a salary, employment type, or job id that the page does not state", () => {
    expect(context.job?.salary).toBeNull();
    expect(context.job?.employmentType).toBeUndefined();
    expect(context.job?.jobId).toBeUndefined();
  });

  it("detects the application form fields and marks the legal question as sensitive", () => {
    const authorized = context.fields.find((f) => /authorized/i.test(f.label));
    expect(authorized?.confidence).toBe("sensitive_manual");
    expect(context.fields.find((f) => f.mappedKey === "email")).toMatchObject({ confidence: "high" });
  });
});

describe("what is NOT treated as a job", () => {
  it("an article with a heading and no form is not a job posting", () => {
    expect(detectPageContext(load(ARTICLE_PAGE), "https://blog.example.com/resume-tips", null, null).job).toBeNull();
  });

  it("a thin description is reported as insufficient instead of scored", () => {
    const context = detectPageContext(load(THIN_JOB), "https://careers.contoso.example/analyst", null, null);
    expect(context.job?.title).toBe("Analyst");
    expect(context.intelligence?.sufficientForMatch).toBe(false);
    expect(context.intelligence?.insufficiencyReason).toContain(NOT_ENOUGH_INFO);
  });

  it("is low confidence for a generic page whose only evidence is a heading with a form-free layout", () => {
    const doc = load(`<html><body><h1>Support Technician at Contoso</h1><p>Short.</p></body></html>`);
    const context = detectPageContext(doc, "https://example.com/p", null, null);
    expect(context.job).toBeNull();
  });
});

describe("description reader", () => {
  it("skips forms, navigation, scripts, and hidden content", () => {
    const doc = load(`<body><div id="job-description"><nav>Home Jobs About</nav><p>${"Real description text. ".repeat(10)}</p><form><input value="secret"><label>Password</label></form><div hidden>Hidden text</div><script>var token="abc123"</script></div></body>`);
    const result = extractJobDescription(doc, "generic", "Generic", false);
    expect(result?.text).toMatch(/Real description text/);
    for (const leaked of ["Home Jobs", "secret", "Password", "Hidden text", "abc123"]) expect(result?.text).not.toContain(leaked);
  });

  it("caps very long pages", () => {
    const doc = load(`<body><div id="job-description"><p>${"word ".repeat(10000)}</p></div></body>`);
    const result = extractJobDescription(doc, "generic", "Generic", false);
    expect(result?.text.length).toBeLessThanOrEqual(20_000);
    expect(result?.truncated).toBe(true);
  });

  it("turns lists into bullets and headings into their own lines", () => {
    const doc = load(`<body><div><h3>Requirements</h3><ul><li>Python</li><li>SQL</li></ul></div></body>`);
    expect(structuredText(doc.body)).toBe("Requirements\n• Python\n• SQL");
  });

  it("only falls back to the page's main text when the page is already trusted as a job", () => {
    const doc = load(ARTICLE_PAGE);
    expect(extractJobDescription(doc, "generic", "Generic", false)).toBeNull();
    expect(extractJobDescription(doc, "generic", "Generic", true)?.source).toMatch(/Main content/);
  });
});

describe("embedded application frames", () => {
  it("notices a known applicant system embedded from another site, and ignores the rest", () => {
    const frames = findEmbeddedApplicationFrames(load(EMBEDDED_FORM_PAGE), "https://careers.northwind.example/join");
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ host: "boards.greenhouse.io", platformLabel: expect.stringMatching(/Greenhouse/i) });
  });

  it("is reported on the page context so the panel can explain the limit", () => {
    const context = detectPageContext(load(EMBEDDED_FORM_PAGE), "https://careers.northwind.example/join", null, null);
    expect(context.embeddedFrames).toHaveLength(1);
    expect(context.fields).toHaveLength(0);
  });
});

describe("open shadow roots", () => {
  function mountShadowForm() {
    document.body.innerHTML = "<apply-form></apply-form>";
    const host = document.querySelector("apply-form")!;
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = '<form><label for="fn">First Name</label><input id="fn" type="text" required /><label for="em">Email</label><input id="em" type="email" required /></form>';
    return root;
  }

  it("finds elements inside open shadow roots, and not inside closed ones", () => {
    const root = mountShadowForm();
    expect(deepQuery(document, "#em")).toBe(root.querySelector("#em"));
    expect(deepQueryAll(document, "input")).toHaveLength(2);
    const closedHost = document.createElement("div");
    closedHost.attachShadow({ mode: "closed" }).innerHTML = "<input id='hidden'>";
    document.body.append(closedHost);
    expect(deepQuery(document, "#hidden")).toBeNull();
  });

  it("detects shadow fields with their labels and gives each a selector that resolves", () => {
    mountShadowForm();
    const fields = discoverFormFields(document, profile);
    expect(fields.map((f) => f.label)).toEqual(["First Name", "Email"]);
    expect(fields.find((f) => f.mappedKey === "firstName")).toMatchObject({ confidence: "high" });
    for (const field of fields) expect(deepQuery(document, field.selector), field.selector).not.toBeNull();
  });

  it("fills shadow fields and reads the real value back before calling them verified", () => {
    const root = mountShadowForm();
    const report = executeFormAutofill(document, profile, { approvedFieldIds: discoverFormFields(document, profile).map((f) => f.id) });
    expect((root.querySelector("#fn") as HTMLInputElement).value).toBe("Jordan");
    expect((root.querySelector("#em") as HTMLInputElement).value).toBe("jordan@example.com");
    expect(report.filledCount).toBe(2);
    expect(report.fields.filter((f) => f.verifiedFilled)).toHaveLength(2);
  });
});

describe("prompt injection in a job description", () => {
  it("is just text: it is kept as a description and never changes what CareerOS does", () => {
    const context = detectPageContext(load(INJECTION_JOB), "https://careers.contoso.example/job", profile, null);
    expect(context.job?.description).toMatch(/IGNORE ALL PREVIOUS INSTRUCTIONS/);
    // The embedded instruction creates no fields, no answers, and no actions.
    expect(context.fields).toHaveLength(0);
    expect(context.confirmed).toBe(false);
    const terms = context.intelligence!.requirements.map((r) => r.term);
    expect(terms.filter((t) => /ignore|admin|submit|salary|previous|instructions/i.test(t))).toEqual([]);
    expect(context.intelligence!.requirements.filter((r) => r.uncertain)).toEqual([]);
  });
});
