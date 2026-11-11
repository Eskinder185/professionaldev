import { validateAndAnalyzeJobUrl } from "../../../../packages/careeros-shared/schemas";
import type { PlatformId, PlatformSupportLevel } from "../../../../packages/careeros-shared/types";

/**
 * Decides whether CareerOS may look at a page, and says why not when it may not.
 *
 * Reading a page is only ever offered for ordinary https websites. Browser-internal pages, other
 * schemes, plain-http sites, and sites that hold sensitive personal accounts (banking, webmail,
 * password managers, patient portals) are refused with an explanation. This applies to both
 * one-time analysis and "always assist", so the extension is never asked to watch them.
 */

export type RestrictedCategory = "banking" | "email" | "password-manager" | "health" | "identity";

export type SiteAccess =
  | { status: "browser-page"; message: string }
  | { status: "unsupported-scheme"; message: string }
  | { status: "insecure"; message: string }
  | { status: "restricted"; category: RestrictedCategory; message: string }
  | {
      status: "ok";
      origin: string;
      hostname: string;
      platform: PlatformId;
      supportLevel: PlatformSupportLevel;
      /** True for the employer applicant systems CareerOS has adapters for. */
      knownApplicantSystem: boolean;
      message: string;
    }
  | { status: "invalid"; message: string };

const SENSITIVE: Array<{ category: RestrictedCategory; hosts: string[] }> = [
  {
    category: "banking",
    hosts: [
      "chase.com", "bankofamerica.com", "wellsfargo.com", "citi.com", "citibank.com", "capitalone.com", "usbank.com", "pnc.com", "tdbank.com", "ally.com", "discover.com", "americanexpress.com",
      "paypal.com", "venmo.com", "cash.app", "wise.com", "coinbase.com", "binance.com", "kraken.com", "robinhood.com", "schwab.com", "fidelity.com", "vanguard.com", "etrade.com", "mint.com",
    ],
  },
  {
    category: "email",
    hosts: ["mail.google.com", "outlook.live.com", "outlook.office.com", "outlook.office365.com", "mail.yahoo.com", "mail.proton.me", "proton.me", "protonmail.com", "mail.aol.com", "icloud.com", "fastmail.com", "mail.zoho.com"],
  },
  {
    category: "password-manager",
    hosts: ["1password.com", "my.1password.com", "lastpass.com", "bitwarden.com", "vault.bitwarden.com", "dashlane.com", "keepersecurity.com", "nordpass.com", "roboform.com"],
  },
  {
    category: "health",
    hosts: ["mychart.com", "myhealth.va.gov", "kp.org", "anthem.com", "uhc.com", "cigna.com", "aetna.com", "humana.com", "healthcare.gov", "zocdoc.com", "teladoc.com"],
  },
  { category: "identity", hosts: ["login.gov", "id.me", "irs.gov", "ssa.gov", "accounts.google.com", "login.microsoftonline.com", "appleid.apple.com", "myaccount.google.com"] },
];

const CATEGORY_TEXT: Record<RestrictedCategory, string> = {
  banking: "banking and payment",
  email: "email",
  "password-manager": "password manager",
  health: "health and insurance",
  identity: "sign-in and identity",
};

/** Job pages hosted by these companies are still job pages: "careers.chase.com" is not a bank account. */
const CAREER_HOST_PREFIX = /^(careers?|jobs?|talent|apply|recruiting|work)\./i;

const matchesHost = (hostname: string, domain: string) => hostname === domain || hostname.endsWith(`.${domain}`);

export function classifySite(rawUrl: string | undefined | null): SiteAccess {
  if (!rawUrl) return { status: "invalid", message: "There’s no page to look at in this window." };
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { status: "invalid", message: "CareerOS couldn’t read this page’s address." };
  }
  const { protocol } = url;
  if (/^(chrome|chrome-extension|edge|about|devtools|view-source|brave|vivaldi|opera):$/.test(protocol)) {
    return { status: "browser-page", message: "Browsers don’t let extensions read their own pages, such as settings and the new-tab page. Open a job posting and try again." };
  }
  if (protocol !== "https:" && protocol !== "http:") {
    return { status: "unsupported-scheme", message: "CareerOS only works on web pages (http or https), not files, downloads, or other kinds of address." };
  }
  const hostname = url.hostname.toLowerCase();
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  if (protocol === "http:" && !isLocal) {
    return { status: "insecure", message: "This page isn’t using a secure connection (https), so CareerOS won’t read it or ask for ongoing access." };
  }

  const known = validateAndAnalyzeJobUrl(rawUrl);
  const platform: PlatformId = (known.ok && known.platform) || "generic";
  const supportLevel: PlatformSupportLevel = (known.ok && known.supportLevel) || "partial";
  const knownApplicantSystem = platform !== "generic" && platform !== "unsupported";

  if (!knownApplicantSystem && !CAREER_HOST_PREFIX.test(hostname)) {
    for (const group of SENSITIVE) {
      if (group.hosts.some((domain) => matchesHost(hostname, domain))) {
        return {
          status: "restricted",
          category: group.category,
          message: `This looks like a ${CATEGORY_TEXT[group.category]} site. CareerOS doesn’t read these, and won’t ask for access to them.`,
        };
      }
    }
  }

  const message =
    platform === "unsupported"
      ? "This site limits automated help (it needs a sign-in or restricts tools like this). CareerOS can’t fill applications here, so use your own copy of the details."
      : knownApplicantSystem
        ? "A supported employer application system."
        : "An ordinary website. CareerOS can read it when you ask, and only the job details and application form are used.";
  return { status: "ok", origin: url.origin, hostname, platform, supportLevel, knownApplicantSystem, message };
}

/** The pattern used for a site permission, or null when CareerOS must not ask. */
export function sitePermissionPattern(rawUrl: string | undefined | null): string | null {
  const access = classifySite(rawUrl);
  if (access.status !== "ok") return null;
  // Only https can be requested; localhost is already covered at install for development.
  if (!access.origin.startsWith("https://")) return null;
  // Gated sites that restrict automated tools are never requested.
  if (access.platform === "unsupported") return null;
  return `${access.origin}/*`;
}
