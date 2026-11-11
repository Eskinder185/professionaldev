import { deepQuery, deepQueryAll, isInShadowRoot } from "../dom/deepQuery";
import type {
  DetectedField,
  FieldConfidence,
  FieldReviewStatus,
  PageStage,
  PlatformId,
  PlatformSupportLevel,
  SharedProfileSubset,
  StandardProfileFieldKey,
} from "../types";

export interface SensitiveCheckResult {
  isSensitive: boolean;
  reason?: string;
}

const SENSITIVE_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\b(?:authorized to work|legally authorized|work authorization|right to work|eligible to work)\b/i,
    reason: "Work authorization declaration requires direct user input.",
  },
  {
    re: /\b(?:visa sponsorship|require sponsorship|future sponsorship|h-?1b|immigration sponsorship)\b/i,
    reason: "Visa sponsorship question requires direct user input.",
  },
  {
    re: /\b(?:felony|convicted|criminal history|criminal record|background check consent|consent to a background)\b/i,
    reason: "Background or criminal-history declaration requires direct user input.",
  },
  {
    re: /\b(?:disability status|handicap|veteran status|protected veteran|race|ethnicity|hispanic or latino|gender identity|sexual orientation|demographic|eeo|equal employment)\b/i,
    reason: "Demographic / EEO self-identification is never auto-answered.",
  },
  {
    re: /\b(?:electronic signature|type your full name as your signature|i certify that|under penalty of perjury|acknowledge and agree|agree to the terms|privacy policy consent)\b/i,
    reason: "Legal certification, acknowledgment, or electronic signature requires direct user action.",
  },
  {
    re: /\b(?:salary expectation|desired salary|desired compensation|expected compensation|minimum pay|hourly rate expectation)\b/i,
    reason: "Salary / compensation expectation requires explicit user confirmation.",
  },
  {
    re: /\b(?:security clearance|active clearance|ts\/sci|polygraph)\b/i,
    reason: "Security clearance declaration requires direct user input.",
  },
];

/**
 * Checks whether a field label or question text represents a sensitive, demographic, or legal question.
 */
export function checkSensitiveField(combinedText: string): SensitiveCheckResult {
  const normalized = combinedText.replace(/\s+/g, " ").trim();
  for (const item of SENSITIVE_PATTERNS) {
    if (item.re.test(normalized)) {
      return { isSensitive: true, reason: item.reason };
    }
  }
  return { isSensitive: false };
}

interface FieldPatternRule {
  key: StandardProfileFieldKey;
  exact: RegExp[];
  partial: RegExp[];
}

const FIELD_RULES: FieldPatternRule[] = [
  {
    key: "firstName",
    exact: [/^(?:first[\s_-]*name|given[\s_-]*name|forename|fname)$/i],
    partial: [/\b(?:first\s+name|given\s+name|legal\s+first\s+name)\b/i],
  },
  {
    key: "lastName",
    exact: [/^(?:last[\s_-]*name|family[\s_-]*name|surname|lname)$/i],
    partial: [/\b(?:last\s+name|family\s+name|surname|legal\s+last\s+name)\b/i],
  },
  {
    key: "preferredName",
    exact: [/^(?:preferred[\s_-]*name|chosen[\s_-]*name|nickname)$/i],
    partial: [/\b(?:preferred\s+name|chosen\s+name|what\s+should\s+we\s+call\s+you)\b/i],
  },
  {
    key: "fullName",
    exact: [/^(?:full[\s_-]*name|name|applicant[\s_-]*name|candidate[\s_-]*name)$/i],
    partial: [/\b(?:full\s+name|your\s+full\s+name|legal\s+name)\b/i],
  },
  {
    key: "email",
    exact: [/^(?:e-?mail|email[\s_-]*address|user[\s_-]*email)$/i],
    partial: [/\b(?:e-?mail\s+address|contact\s+email|primary\s+email)\b/i],
  },
  {
    key: "phone",
    exact: [/^(?:phone|phone[\s_-]*number|mobile|mobile[\s_-]*phone|telephone|tel|cell)$/i],
    partial: [/\b(?:phone\s+number|mobile\s+number|contact\s+number|telephone)\b/i],
  },
  {
    key: "linkedin",
    exact: [/^(?:linkedin|linkedin[\s_-]*url|linkedin[\s_-]*profile|urls\[linkedin\])$/i],
    partial: [/\b(?:linkedin\s+profile|linkedin\s+url|linkedin\.com)\b/i],
  },
  {
    key: "github",
    exact: [/^(?:github|github[\s_-]*url|github[\s_-]*profile|urls\[github\])$/i],
    partial: [/\b(?:github\s+profile|github\s+url|github\.com)\b/i],
  },
  {
    key: "website",
    exact: [/^(?:website|portfolio|portfolio[\s_-]*url|personal[\s_-]*website|urls\[portfolio\])$/i],
    partial: [/\b(?:portfolio\s+url|personal\s+website|portfolio\s+or\s+website)\b/i],
  },
  {
    key: "city",
    exact: [/^(?:city|town|locality)$/i],
    partial: [/\b(?:current\s+city|city\s+of\s+residence)\b/i],
  },
  {
    key: "state",
    exact: [/^(?:state|province|region|state[\s_-]*province)$/i],
    partial: [/\b(?:state\s*\/\s*province|state\s+or\s+region)\b/i],
  },
  {
    key: "country",
    exact: [/^(?:country|country[\s_-]*region)$/i],
    partial: [/\b(?:country\s+of\s+residence)\b/i],
  },
  {
    key: "location",
    exact: [/^(?:location|current[\s_-]*location|address[\s_-]*city[\s_-]*state)$/i],
    partial: [/\b(?:current\s+location|city,\s*state)\b/i],
  },
  {
    key: "currentEmployer",
    exact: [/^(?:company|current[\s_-]*company|employer|current[\s_-]*employer|org|organization)$/i],
    partial: [/\b(?:current\s+company|current\s+employer|most\s+recent\s+employer)\b/i],
  },
  {
    key: "currentTitle",
    exact: [/^(?:title|job[\s_-]*title|current[\s_-]*title|role|current[\s_-]*role)$/i],
    partial: [/\b(?:current\s+job\s+title|current\s+title|most\s+recent\s+title)\b/i],
  },
  {
    key: "headline",
    exact: [/^(?:headline|professional[\s_-]*headline)$/i],
    partial: [/\b(?:professional\s+headline)\b/i],
  },
  {
    key: "school",
    exact: [/^(?:school|university|college|institution|alma[\s_-]*mater|university\s*\/?\s*school)$/i],
    partial: [/\b(?:university|school|college|educational\s+institution)\b/i],
  },
  {
    key: "degree",
    exact: [/^(?:degree|highest[\s_-]*degree|education[\s_-]*level)$/i],
    partial: [/\b(?:highest\s+degree|degree\s+type|degree\s+earned)\b/i],
  },
  {
    key: "major",
    exact: [/^(?:major|field[\s_-]*of[\s_-]*study|discipline)$/i],
    partial: [/\b(?:field\s+of\s+study|major\s+or\s+concentration)\b/i],
  },
  {
    key: "graduationDate",
    exact: [/^(?:graduation[\s_-]*year|graduation[\s_-]*date|grad[\s_-]*year)$/i],
    partial: [/\b(?:graduation\s+date|graduation\s+year|year\s+of\s+graduation)\b/i],
  },
  {
    key: "skillsSummary",
    exact: [/^(?:skills|technical[\s_-]*skills|relevant[\s_-]*skills)$/i],
    partial: [/\b(?:list\s+your\s+technical\s+skills|relevant\s+technical\s+skills)\b/i],
  },
  {
    key: "certificationsSummary",
    exact: [/^(?:certifications|licenses[\s_-]*and[\s_-]*certifications)$/i],
    partial: [/\b(?:relevant\s+certifications|professional\s+certifications)\b/i],
  },
  {
    key: "coverLetter",
    exact: [/^(?:cover[\s_-]*letter|additional[\s_-]*information)$/i],
    partial: [/\b(?:cover\s+letter)\b/i],
  },
];

export interface SemanticFieldResolution {
  mappedKey: StandardProfileFieldKey | null;
  confidence: FieldConfidence;
  sensitiveReason?: string;
}

/**
 * Resolves a form field's metadata into a StandardProfileFieldKey and confidence level.
 */
export function resolveSemanticField(meta: {
  label: string;
  nameAttr?: string;
  idAttr?: string;
  placeholder?: string;
  surroundingText?: string;
  inputType?: string;
}): SemanticFieldResolution {
  const nameAttr = meta.nameAttr ?? "";
  const idAttr = meta.idAttr ?? "";
  const placeholder = meta.placeholder ?? "";
  const surroundingText = meta.surroundingText ?? "";
  const inputType = meta.inputType ?? "text";

  const combined = [meta.label, surroundingText, placeholder, nameAttr, idAttr]
    .filter(Boolean)
    .join(" ");

  const sensitive = checkSensitiveField(combined);
  if (sensitive.isSensitive) {
    return {
      mappedKey: null,
      confidence: "sensitive_manual",
      sensitiveReason: sensitive.reason,
    };
  }

  if (inputType === "file") {
    return {
      mappedKey: null,
      confidence: "needs_review",
    };
  }

  const cleanLabel = meta.label.replace(/(\*|\(optional\)|\(required\)|:)+/gi, "").trim();
  const candidates = [cleanLabel, nameAttr.trim(), idAttr.trim(), placeholder.trim()].filter(Boolean);

  // 1. High-confidence exact match on label, name, or id
  for (const rule of FIELD_RULES) {
    for (const candidate of candidates) {
      if (rule.exact.some((re) => re.test(candidate))) {
        return { mappedKey: rule.key, confidence: "high" };
      }
    }
  }

  // 2. High-confidence partial match on label or name/id
  const primaryText = `${cleanLabel} ${nameAttr} ${idAttr}`;
  for (const rule of FIELD_RULES) {
    if (rule.partial.some((re) => re.test(primaryText))) {
      return { mappedKey: rule.key, confidence: "high" };
    }
  }

  // 3. Input type fallback for email / tel
  if (inputType === "email" && /mail/i.test(combined)) {
    return { mappedKey: "email", confidence: "high" };
  }
  if (inputType === "tel" && /phone|tel|mobile|cell/i.test(combined)) {
    return { mappedKey: "phone", confidence: "high" };
  }

  // 4. Open-ended application question (textarea or question label)
  if (
    inputType === "textarea" ||
    /\b(?:why are you interested|describe your|what experience do you have|explain a difficult|tell us about)\b/i.test(
      combined,
    )
  ) {
    return { mappedKey: "customQuestion", confidence: "needs_review" };
  }

  // 5. Surrounding text partial match -> needs_review
  for (const rule of FIELD_RULES) {
    if (rule.partial.some((re) => re.test(combined))) {
      return { mappedKey: rule.key, confidence: "needs_review" };
    }
  }

  return { mappedKey: null, confidence: "unsupported" };
}

/**
 * Normalizes a profile value for a target field (e.g., phone formatting, URL prefixing, select option matching).
 */
export function normalizeFieldValue(
  key: StandardProfileFieldKey,
  rawValue: string,
  options?: string[],
): string {
  let val = rawValue.trim();
  if (!val) return "";

  if (key === "phone") {
    const digits = val.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }

  if (key === "country" && /^(?:us|usa|u\.s\.a\.?)$/i.test(val)) {
    val = "United States";
  }

  if ((key === "linkedin" || key === "github" || key === "website") && !/^https?:\/\//i.test(val)) {
    return `https://${val}`;
  }

  if (options && options.length > 0) {
    const exact = options.find((o) => o.toLowerCase().trim() === val.toLowerCase());
    if (exact) return exact;
    const partial = options.find(
      (o) =>
        o.toLowerCase().includes(val.toLowerCase()) ||
        val.toLowerCase().includes(o.toLowerCase()),
    );
    if (partial) return partial;
  }

  return val;
}

/**
 * Matches an open-ended question against prepared question answers in the shared profile subset.
 */
export function matchPreparedQuestionAnswer(
  questionLabel: string,
  profile?: SharedProfileSubset | null,
): { answer: string; evidence: string; approved: boolean } | null {
  if (!profile?.preparedAnswers) return null;
  const normQ = questionLabel.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const entry of Object.values(profile.preparedAnswers)) {
    const targetQ = entry.question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!targetQ) continue;
    if (normQ.includes(targetQ) || targetQ.includes(normQ)) {
      return entry;
    }
    // Keyword overlap for standard questions (troubleshooting, linux, interested, difficult problem)
    const keywords = ["interested", "troubleshooting", "linux", "difficult", "problem", "experience"];
    for (const kw of keywords) {
      if (normQ.includes(kw) && targetQ.includes(kw)) {
        return entry;
      }
    }
  }
  return null;
}

/**
 * Discovers all interactive form fields inside a root HTMLElement or Document and maps them against SharedProfileSubset.
 */
export function discoverFormFields(
  root: Document | HTMLElement,
  profile?: SharedProfileSubset | null,
): DetectedField[] {
  const elements = deepQueryAll<HTMLElement>(
    root,
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [role="combobox"]',
  );

  const fields: DetectedField[] = [];

  elements.forEach((el, index) => {
    // Ignore CareerOS's own internal UI controls if running on a mixed page unless inside an explicit application form container
    const tag = el.tagName.toLowerCase();
    const rawType = (el.getAttribute("type") || (tag === "textarea" ? "textarea" : tag === "select" ? "select" : "text")).toLowerCase();
    const role = el.getAttribute("role");

    let inputType: DetectedField["inputType"] = "text";
    if (role === "combobox" && tag !== "select" && tag !== "input") inputType = "custom-select";
    else if (tag === "textarea") inputType = "textarea";
    else if (tag === "select") inputType = "select";
    else if (rawType === "email") inputType = "email";
    else if (rawType === "tel") inputType = "tel";
    else if (rawType === "url") inputType = "url";
    else if (rawType === "checkbox") inputType = "checkbox";
    else if (rawType === "radio") inputType = "radio";
    else if (rawType === "file") inputType = "file";

    const idAttr = el.getAttribute("id") || "";
    const nameAttr = el.getAttribute("name") || el.getAttribute("data-field") || "";
    const placeholder = el.getAttribute("placeholder") || "";
    const required =
      el.hasAttribute("required") ||
      el.getAttribute("aria-required") === "true" ||
      Boolean(el.closest(".required, [data-required='true']"));

    // Resolve accessible label
    let label = el.getAttribute("aria-label") || "";
    if (!label && idAttr) {
      // Labels live in the same tree (document or shadow root) as their input.
      const ownerTree = (el.getRootNode() as Document | ShadowRoot | undefined) ?? el.ownerDocument ?? document;
      const explicitLabel = ownerTree.querySelector(`label[for="${CSS.escape(idAttr)}"]`);
      if (explicitLabel?.textContent) label = explicitLabel.textContent.trim();
    }
    if (!label) {
      const parentLabel = el.closest("label");
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("input, select, textarea").forEach((n) => n.remove());
        label = clone.textContent?.trim() || "";
      }
    }
    if (!label) {
      const container = el.closest(".field, .form-field, .application-question, .form-group, div");
      const prevLabel = container?.querySelector("label, .field-label, legend");
      if (prevLabel?.textContent) label = prevLabel.textContent.trim();
    }

    const fieldsetLegend = el.closest("fieldset")?.querySelector("legend")?.textContent?.trim() || "";
    const surroundingText = [fieldsetLegend, el.closest(".application-question, .form-field")?.textContent || ""]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);

    // Fields inside a shadow root always get a unique marker, because the same id or name can
    // legitimately repeat in different components.
    const inShadow = isInShadowRoot(el);
    const selector = inShadow
      ? `${tag}[data-autoapply-idx="${index}"]`
      : idAttr
        ? `#${CSS.escape(idAttr)}`
        : nameAttr
          ? `${tag}[name="${CSS.escape(nameAttr)}"]`
          : `${tag}[data-autoapply-idx="${index}"]`;

    if (inShadow || (!idAttr && !nameAttr)) {
      el.setAttribute("data-autoapply-idx", String(index));
    }

    const resolution = resolveSemanticField({
      label: label || fieldsetLegend || nameAttr || idAttr,
      nameAttr,
      idAttr,
      placeholder,
      surroundingText,
      inputType,
    });

    let options: string[] | undefined;
    if (tag === "select") {
      options = Array.from((el as HTMLSelectElement).options)
        .map((o) => o.value || o.textContent?.trim() || "")
        .filter(Boolean);
    } else if (inputType === "custom-select") {
      const optsAttr = el.getAttribute("data-options") || "";
      if (optsAttr) options = optsAttr.split("|").map((s) => s.trim()).filter(Boolean);
    }

    let preparedValue = "";
    let evidence: string | undefined;
    let reviewStatus: FieldReviewStatus = "Unsupported";

    if (resolution.confidence === "sensitive_manual") {
      reviewStatus = "Needs user confirmation";
    } else if (inputType === "file") {
      if (profile?.resumeFileName) {
        preparedValue = profile.resumeFileName;
        evidence = `Selected One-Page Résumé: ${profile.resumeVersionName || profile.resumeFileName}`;
        reviewStatus = "Needs user confirmation";
      } else {
        reviewStatus = "Missing information";
      }
    } else if (resolution.mappedKey === "customQuestion") {
      const matched = matchPreparedQuestionAnswer(label || surroundingText, profile);
      if (matched) {
        preparedValue = matched.answer;
        evidence = matched.evidence;
        reviewStatus = matched.approved ? "Ready" : "Needs user confirmation";
      } else {
        reviewStatus = "Missing information";
      }
    } else if (resolution.mappedKey) {
      const raw = profile?.values?.[resolution.mappedKey] || "";
      if (raw) {
        preparedValue = normalizeFieldValue(resolution.mappedKey, raw, options);
        evidence = `Verified Master Profile (${resolution.mappedKey})`;
        reviewStatus = resolution.confidence === "high" ? "Ready" : "Needs user confirmation";
      } else {
        reviewStatus = "Missing information";
      }
    }

    const currentDomValue =
      tag === "input" && (rawType === "checkbox" || rawType === "radio")
        ? String((el as HTMLInputElement).checked)
        : (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value ||
          el.getAttribute("data-value") ||
          "";

    fields.push({
      id: `field-${index}-${idAttr || nameAttr || tag}`,
      selector,
      nameAttr,
      idAttr,
      inputType,
      label: (label || fieldsetLegend || nameAttr || idAttr || `Field ${index + 1}`).replace(/\s+/g, " ").trim(),
      placeholder,
      surroundingText,
      required,
      mappedKey: resolution.mappedKey,
      confidence: resolution.confidence,
      reviewStatus,
      preparedValue,
      currentDomValue,
      sensitiveReason: resolution.sensitiveReason,
      options,
      evidence,
    });
  });

  return fields;
}

/**
 * Sets an input/textarea/select value in a way that React 16/17/18/19 controlled inputs detect,
 * dispatches input/change/blur events, and reads back the actual DOM value to verify.
 */
export function setElementValueAndVerify(el: HTMLElement, value: string): {
  filled: boolean;
  actualValue: string;
} {
  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute("type") || "").toLowerCase();

  if (type === "file") {
    return { filled: false, actualValue: "" };
  }

  if (el.getAttribute("role") === "combobox" && tag !== "select" && tag !== "input") {
    el.setAttribute("data-value", value);
    el.textContent = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    const actual = el.getAttribute("data-value") || el.textContent || "";
    return { filled: actual === value, actualValue: actual };
  }

  if (tag === "input" && (type === "checkbox" || type === "radio")) {
    const input = el as HTMLInputElement;
    const desired = value === "true" || value === "1" || value.toLowerCase() === "yes";
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
    if (proto) proto.call(input, desired);
    else input.checked = desired;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { filled: input.checked === desired, actualValue: String(input.checked) };
  }

  if (tag === "select") {
    const select = el as HTMLSelectElement;
    const matchOption = Array.from(select.options).find(
      (opt) =>
        opt.value.toLowerCase() === value.toLowerCase() ||
        (opt.textContent || "").trim().toLowerCase() === value.toLowerCase(),
    );
    const targetValue = matchOption ? matchOption.value : value;
    const proto = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    if (proto) proto.call(select, targetValue);
    else select.value = targetValue;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    select.dispatchEvent(new Event("blur", { bubbles: true }));
    return {
      filled: select.value === targetValue && Boolean(targetValue),
      actualValue: select.value,
    };
  }

  const inputOrArea = el as HTMLInputElement | HTMLTextAreaElement;
  const protoObj =
    tag === "textarea" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(protoObj, "value")?.set;
  if (nativeSetter) {
    nativeSetter.call(inputOrArea, value);
  } else {
    inputOrArea.value = value;
  }

  inputOrArea.dispatchEvent(new Event("input", { bubbles: true }));
  inputOrArea.dispatchEvent(new Event("change", { bubbles: true }));
  inputOrArea.dispatchEvent(new Event("blur", { bubbles: true }));

  const actualValue = inputOrArea.value;
  return {
    filled: actualValue === value,
    actualValue,
  };
}

export interface AutofillExecutionReport {
  fields: DetectedField[];
  filledCount: number;
  skippedSensitiveCount: number;
  missingCount: number;
  unsupportedCount: number;
  pageStage: PageStage;
}

/**
 * Executes safe autofill on a root Document or HTMLElement:
 * - Fills high-confidence Ready fields and explicitly user-approved fields
 * - Never fills sensitive_manual or unapproved low-confidence fields
 * - Reads back every filled value to verify
 */
export function executeFormAutofill(
  root: Document | HTMLElement,
  profile: SharedProfileSubset,
  options?: {
    approvedFieldIds?: string[];
    overrideValues?: Record<string, string>;
    /** When set, only these field ids are processed; every other field is reported untouched. */
    onlyFieldIds?: string[];
  },
): AutofillExecutionReport {
  const discovered = discoverFormFields(root, profile);
  const onlySet = options?.onlyFieldIds ? new Set(options.onlyFieldIds) : null;
  const approvedSet = new Set(options?.approvedFieldIds ?? []);
  const overrides = options?.overrideValues ?? {};

  let filledCount = 0;
  let skippedSensitiveCount = 0;
  let missingCount = 0;
  let unsupportedCount = 0;

  const updated = discovered.map((field) => {
    if (onlySet && !onlySet.has(field.id)) {
      return { ...field, verifiedFilled: false };
    }
    if (field.confidence === "sensitive_manual") {
      skippedSensitiveCount += 1;
      return { ...field, verifiedFilled: false };
    }

    const valueToFill = overrides[field.id] !== undefined ? overrides[field.id] : field.preparedValue;
    const isApproved =
      field.reviewStatus === "Ready" ||
      approvedSet.has(field.id) ||
      overrides[field.id] !== undefined;

    if (!valueToFill) {
      if (field.confidence === "unsupported") unsupportedCount += 1;
      else missingCount += 1;
      return { ...field, verifiedFilled: false };
    }

    if (!isApproved || field.inputType === "file") {
      return { ...field, preparedValue: valueToFill, verifiedFilled: false };
    }

    const targetEl = deepQuery<HTMLElement>(root, field.selector);
    if (!targetEl) {
      return { ...field, verifiedFilled: false };
    }

    const res = setElementValueAndVerify(targetEl, valueToFill);
    if (res.filled) {
      filledCount += 1;
      return {
        ...field,
        preparedValue: valueToFill,
        currentDomValue: res.actualValue,
        reviewStatus: "Filled and verified" as FieldReviewStatus,
        verifiedFilled: true,
      };
    }

    return {
      ...field,
      preparedValue: valueToFill,
      currentDomValue: res.actualValue,
      verifiedFilled: false,
    };
  });

  const hasMissingOrReview = updated.some(
    (f) => f.required && f.reviewStatus !== "Filled and verified",
  );

  return {
    fields: updated,
    filledCount,
    skippedSensitiveCount,
    missingCount,
    unsupportedCount,
    pageStage: hasMissingOrReview ? "user_review_required" : "continue_permitted",
  };
}

export interface PlatformAdapterSpec {
  id: PlatformId;
  label: string;
  supportLevel: PlatformSupportLevel;
  urlPatterns: string[];
  capabilities: {
    contactFields: boolean;
    resumeUploadHint: boolean;
    customQuestions: boolean;
    multiStepDetection: boolean;
  };
  limitationsNote?: string;
}

export const PLATFORM_ADAPTERS: Record<PlatformId, PlatformAdapterSpec> = {
  generic: {
    id: "generic",
    label: "Standard HTML / React Career Form",
    supportLevel: "supported",
    urlPatterns: ["http://*/*", "https://*/*"],
    capabilities: {
      contactFields: true,
      resumeUploadHint: true,
      customQuestions: true,
      multiStepDetection: true,
    },
  },
  greenhouse: {
    id: "greenhouse",
    label: "Greenhouse Job Board",
    supportLevel: "supported",
    urlPatterns: ["https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*"],
    capabilities: {
      contactFields: true,
      resumeUploadHint: true,
      customQuestions: true,
      multiStepDetection: false,
    },
  },
  lever: {
    id: "lever",
    label: "Lever Application Form",
    supportLevel: "supported",
    urlPatterns: ["https://jobs.lever.co/*"],
    capabilities: {
      contactFields: true,
      resumeUploadHint: true,
      customQuestions: true,
      multiStepDetection: false,
    },
  },
  ashby: {
    id: "ashby",
    label: "Ashby Job Board (Preview)",
    supportLevel: "partial",
    urlPatterns: ["https://jobs.ashbyhq.com/*"],
    capabilities: {
      contactFields: true,
      resumeUploadHint: true,
      customQuestions: true,
      multiStepDetection: false,
    },
    limitationsNote:
      "Ashby forms use dynamic custom widgets; standard contact and question fields are filled, while custom widgets are highlighted for manual review.",
  },
  workday: {
    id: "workday",
    label: "Workday Career Portal (Guided Mode)",
    supportLevel: "partial",
    urlPatterns: ["https://*.myworkdayjobs.com/*"],
    capabilities: {
      contactFields: true,
      resumeUploadHint: true,
      customQuestions: false,
      multiStepDetection: true,
    },
    limitationsNote:
      "Workday requires candidate sign-in and multi-stage dynamic sections. AutoApply fills visible step fields and provides a copyable checklist without bypassing login or auto-advancing stages.",
  },
  unsupported: {
    id: "unsupported",
    label: "Unsupported / Gated Platform",
    supportLevel: "unsupported",
    urlPatterns: [],
    capabilities: {
      contactFields: false,
      resumeUploadHint: false,
      customQuestions: false,
      multiStepDetection: false,
    },
    limitationsNote:
      "This site uses account walls, anti-automation gates, or proprietary flows that cannot be safely automated. Use the copyable answer checklist and open the official application page manually.",
  },
};
