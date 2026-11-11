import type { EmbeddedFrame } from "../../../../packages/careeros-shared/types";
import { validateAndAnalyzeJobUrl } from "../../../../packages/careeros-shared/schemas";
import { PLATFORM_ADAPTERS } from "../../../../packages/careeros-shared/adapters";

/**
 * Finds application forms embedded from a different website.
 *
 * A page's script cannot read inside a frame from another origin; that is a browser security
 * boundary and CareerOS does not try to get around it. What it can do is notice that an
 * application form from a known applicant system is embedded, and offer to open it in its own tab.
 */
export function findEmbeddedApplicationFrames(doc: Document | HTMLElement, pageUrl: string): EmbeddedFrame[] {
  let pageOrigin: string;
  try {
    pageOrigin = new URL(pageUrl).origin;
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const found: EmbeddedFrame[] = [];
  for (const frame of Array.from(doc.querySelectorAll<HTMLIFrameElement>("iframe[src]")).slice(0, 25)) {
    const raw = frame.getAttribute("src") ?? "";
    let url: URL;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || url.origin === pageOrigin) continue;
    const parsed = validateAndAnalyzeJobUrl(url.href);
    const platform = parsed.ok ? parsed.platform : undefined;
    if (!platform || platform === "generic" || platform === "unsupported") continue;
    if (seen.has(url.origin + url.pathname)) continue;
    seen.add(url.origin + url.pathname);
    found.push({ url: url.href, host: url.hostname, platformLabel: PLATFORM_ADAPTERS[platform]?.label ?? platform });
  }
  return found;
}
