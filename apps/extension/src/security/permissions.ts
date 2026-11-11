import {
  ALLOWED_PRODUCTION_ORIGIN,
  REQUIRED_PATH_PREFIX,
  validateSenderOrigin,
} from "../../../../packages/careeros-shared/schemas";
import type { ExtensionCapabilities } from "../../../../packages/careeros-shared/types";
import { PLATFORM_ADAPTERS } from "../../../../packages/careeros-shared/adapters";

export const EXTENSION_VERSION = "1.0.0";

export function getExtensionCapabilities(): ExtensionCapabilities {
  return {
    extensionVersion: EXTENSION_VERSION,
    protocolVersion: "1.0",
    supportedPlatforms: Object.values(PLATFORM_ADAPTERS).map((a) => ({
      id: a.id,
      label: a.label,
      supportLevel: a.supportLevel,
    })),
    features: {
      sidePanel: true,
      activeTabAutofill: true,
      reactControlledInputs: true,
      multiPageStateMachine: true,
      fileUploadVerification: true,
    },
  };
}

export function isAuthorizedCareerOSSender(senderUrl?: string): {
  ok: boolean;
  origin?: string;
  reason?: string;
} {
  if (!senderUrl) {
    return { ok: false, reason: "Missing sender URL." };
  }
  return validateSenderOrigin(senderUrl);
}

export function isDomainAllowedForAutofill(urlStr: string, allowedDomains: string[]): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return allowedDomains.some(
      (domain) => host === domain.toLowerCase() || host.endsWith(`.${domain.toLowerCase()}`),
    );
  } catch {
    return false;
  }
}

export const SECURITY_DISCLOSURES = {
  productionOrigin: ALLOWED_PRODUCTION_ORIGIN,
  requiredPathPrefix: REQUIRED_PATH_PREFIX,
  minimalPermissions: ["activeTab", "scripting", "storage", "sidePanel"],
  prohibitedBehaviors: [
    "Never reads passwords, cookies, payment details, or unrelated browsing tabs.",
    "Never receives or stores AI API keys inside content scripts or extension storage.",
    "Never auto-answers work authorization, visa sponsorship, EEO/demographic, background-check, or legal signature fields.",
    "Never bypasses CAPTCHA, anti-bot gates, or login walls.",
    "Never submits an application without explicit user review and confirmation.",
  ],
};
