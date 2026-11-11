import type { PlatformId } from "../../../../packages/careeros-shared/types";

/**
 * Reads the job description from the page, keeping its structure.
 *
 * Headings and bullets matter: the requirement extractor decides "required" versus "preferred"
 * from section headings and list items, so plain textContent (which loses line breaks) would make
 * every requirement look the same. Form controls, scripts, navigation, and hidden content are
 * never read, and the text is capped, so unrelated page content does not leave the page reader.
 */

export const MAX_DESCRIPTION_CHARS = 20_000;

export interface DescriptionResult {
  text: string;
  /** Human-readable origin, shown to the person as evidence. */
  source: string;
  truncated: boolean;
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "FORM", "NAV", "HEADER", "FOOTER", "ASIDE", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SVG", "IFRAME", "TEMPLATE", "LABEL"]);
const BLOCK_TAGS = new Set(["P", "DIV", "SECTION", "ARTICLE", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "TR", "BR", "BLOCKQUOTE", "DL", "DT", "DD", "TABLE"]);

function isHidden(el: Element): boolean {
  if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return true;
  const style = (el as HTMLElement).style;
  return style?.display === "none" || style?.visibility === "hidden";
}

/** Turns an element into readable lines: headings and paragraphs on their own line, list items as bullets. */
export function structuredText(root: Element): string {
  const lines: string[] = [];
  let current = "";
  const flush = () => {
    const text = current.replace(/\s+/g, " ").trim();
    if (text) lines.push(text);
    current = "";
  };
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      current += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (SKIP_TAGS.has(el.tagName.toUpperCase()) || isHidden(el)) return;
    const block = BLOCK_TAGS.has(el.tagName);
    if (block) flush();
    if (el.tagName === "LI") current = "• ";
    if (el.tagName === "BR") {
      flush();
      return;
    }
    for (const child of Array.from(el.childNodes)) visit(child);
    if (block) flush();
  };
  visit(root);
  flush();
  return lines.join("\n");
}

const COMMON = ['[itemprop="description"]', '[data-testid="job-description"]', '[data-qa="job-description"]', "#job-description", ".job-description", '[class*="job-description" i]', '[id*="job-description" i]'];

const PLATFORM_SELECTORS: Partial<Record<PlatformId, string[]>> = {
  greenhouse: ["#content .job__description", ".job__description", "#content"],
  lever: ['[data-qa="job-description"]', ".posting-page .section-wrapper", ".posting-page .content"],
  ashby: ['[class*="_descriptionText" i]', '[class*="description" i]'],
  workday: ['[data-automation-id="jobPostingDescription"]'],
};

const MIN_USEFUL = 120;

function describe(el: Element): string {
  const id = el.getAttribute("id");
  if (id) return `#${id}`;
  const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean)[0];
  return cls ? `.${cls}` : el.tagName.toLowerCase();
}

/**
 * Finds the job description. `trustPage` allows the generic main/article fallback, used only when the
 * page has other evidence of being a job (an application form or a job-like title).
 */
export function extractJobDescription(doc: Document | HTMLElement, platform: PlatformId, platformLabel: string, trustPage: boolean): DescriptionResult | null {
  const candidates: Array<{ selectors: string[]; source: (el: Element) => string }> = [
    { selectors: PLATFORM_SELECTORS[platform] ?? [], source: (el) => `${platformLabel} page (${describe(el)})` },
    { selectors: COMMON, source: (el) => `Job description section (${describe(el)})` },
  ];
  for (const { selectors, source } of candidates) {
    for (const selector of selectors) {
      let found: Element | null;
      try {
        found = doc.querySelector(selector);
      } catch {
        found = null;
      }
      if (!found) continue;
      const text = structuredText(found);
      if (text.length >= MIN_USEFUL) return { text: text.slice(0, MAX_DESCRIPTION_CHARS), source: source(found), truncated: text.length > MAX_DESCRIPTION_CHARS };
    }
  }
  if (!trustPage) return null;
  // Last resort: the largest main/article region that is not a form.
  let best: { el: Element; text: string } | null = null;
  for (const el of Array.from(doc.querySelectorAll("main, article, [role='main']"))) {
    if (isHidden(el)) continue;
    const text = structuredText(el);
    if (text.length >= 400 && (!best || text.length > best.text.length)) best = { el, text };
  }
  return best ? { text: best.text.slice(0, MAX_DESCRIPTION_CHARS), source: `Main content of the page (${describe(best.el)})`, truncated: best.text.length > MAX_DESCRIPTION_CHARS } : null;
}
