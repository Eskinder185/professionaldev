import { shadowRootsIn } from "../../../../packages/careeros-shared/dom/deepQuery";

/**
 * Watches a page for changes that matter to an application, without hammering it.
 *
 * Modern application pages swap steps and add fields without reloading. Rather than rescanning
 * the document on every mutation, this:
 *  - batches mutations and checks at most once per `throttleMs` (trailing),
 *  - reports only when a compact signature of the form changes (which fields exist, the heading,
 *    the address), so ordinary typing, animations, and ads cause no work downstream,
 *  - caps reports per minute so a misbehaving page cannot flood the side panel,
 *  - does nothing while the tab is hidden, catching up when it becomes visible,
 *  - covers open shadow roots (closed ones are unreachable by design),
 *  - never polls on a timer: it wakes only when the page changes.
 */

export type ChangeReason = "dom" | "url" | "visible";

export interface PageObserverOptions {
  doc: Document;
  win: Window;
  onChange: (reason: ChangeReason) => void;
  throttleMs?: number;
  maxPerMinute?: number;
  maxShadowRoots?: number;
  now?: () => number;
}

export interface PageObserver {
  start(): void;
  stop(): void;
  readonly active: boolean;
  /** Reports sent so far (for diagnostics and tests). */
  readonly reports: number;
}

const CONTROL_SELECTOR = 'input:not([type="hidden"]), select, textarea, [role="combobox"]';

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** A compact fingerprint of what the page currently offers: its address, heading, and which fields exist. */
export function pageSignature(doc: Document, url: string): string {
  const roots: Array<Document | ShadowRoot> = [doc, ...shadowRootsIn(doc)];
  const controls: string[] = [];
  let forms = 0;
  for (const root of roots) {
    forms += root.querySelectorAll("form").length;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)).slice(0, 120)) {
      if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") continue;
      controls.push(`${el.tagName}:${el.getAttribute("name") || el.getAttribute("id") || el.getAttribute("aria-label") || el.getAttribute("type") || ""}`);
    }
  }
  const heading = (doc.querySelector("h1")?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const step = (doc.querySelector('[aria-current="step"], [aria-current="page"]')?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return hash(`${url}|${forms}|${heading}|${step}|${controls.join(",")}`);
}

export function createPageObserver(options: PageObserverOptions): PageObserver {
  const { doc, win, onChange, throttleMs = 700, maxPerMinute = 20, maxShadowRoots = 50, now = () => Date.now() } = options;
  let active = false;
  let reports = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSignature = "";
  let pendingReason: ChangeReason = "dom";
  let mutations: MutationObserver | null = null;
  const watchedRoots = new WeakSet<Node>();
  const recent: number[] = [];

  const observeRoot = (root: Node) => {
    if (!mutations || watchedRoots.has(root)) return;
    watchedRoots.add(root);
    mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "disabled", "required", "aria-hidden", "aria-current"] });
  };

  const flush = () => {
    timer = null;
    if (!active) return;
    // Hidden tabs do no work; becoming visible schedules a catch-up.
    if (doc.visibilityState === "hidden") return;
    for (const shadow of shadowRootsIn(doc).slice(0, maxShadowRoots)) observeRoot(shadow);
    const signature = pageSignature(doc, win.location.href);
    if (signature === lastSignature) return;
    lastSignature = signature;
    const t = now();
    while (recent.length && t - recent[0] > 60_000) recent.shift();
    if (recent.length >= maxPerMinute) return;
    recent.push(t);
    reports += 1;
    onChange(pendingReason);
    pendingReason = "dom";
  };

  const schedule = (reason: ChangeReason = "dom") => {
    if (!active) return;
    if (reason !== "dom") pendingReason = reason;
    if (timer !== null) return;
    timer = setTimeout(flush, throttleMs);
  };

  const onUrl = () => schedule("url");
  const onVisible = () => {
    if (doc.visibilityState === "visible") schedule("visible");
  };

  return {
    start() {
      if (active) return;
      active = true;
      lastSignature = pageSignature(doc, win.location.href);
      mutations = new MutationObserver(() => schedule("dom"));
      observeRoot(doc.documentElement);
      for (const shadow of shadowRootsIn(doc).slice(0, maxShadowRoots)) observeRoot(shadow);
      win.addEventListener("popstate", onUrl);
      win.addEventListener("hashchange", onUrl);
      doc.addEventListener("visibilitychange", onVisible);
    },
    stop() {
      active = false;
      mutations?.disconnect();
      mutations = null;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      win.removeEventListener("popstate", onUrl);
      win.removeEventListener("hashchange", onUrl);
      doc.removeEventListener("visibilitychange", onVisible);
    },
    get active() {
      return active;
    },
    get reports() {
      return reports;
    },
  };
}
