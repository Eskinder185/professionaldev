import {
  discoverFormFields,
  executeFormAutofill,
  PLATFORM_ADAPTERS,
  type AutofillExecutionReport,
} from "../../../../../packages/careeros-shared/adapters";
import type {
  DetectedField,
  PlatformId,
  SharedProfileSubset,
} from "../../../../../packages/careeros-shared/types";

export interface RuntimePlatformAdapter {
  id: PlatformId;
  label: string;
  supportLevel: "supported" | "partial" | "unsupported";
  matches(url: string, doc?: Document | HTMLElement): boolean;
  findFormRoot(doc: Document | HTMLElement): HTMLElement | Document;
  discover(doc: Document | HTMLElement, profile?: SharedProfileSubset | null): DetectedField[];
  autofill(
    doc: Document | HTMLElement,
    profile: SharedProfileSubset,
    options?: { approvedFieldIds?: string[]; overrideValues?: Record<string, string>; onlyFieldIds?: string[] },
  ): AutofillExecutionReport;
  detectConfirmation(doc: Document | HTMLElement): { confirmed: boolean; text?: string };
}

export const genericAdapter: RuntimePlatformAdapter = {
  id: "generic",
  label: PLATFORM_ADAPTERS.generic.label,
  supportLevel: "supported",
  matches() {
    return true;
  },
  findFormRoot(doc) {
    return (
      doc.querySelector<HTMLElement>(
        '[data-testid="synthetic-application-form"], form[data-autoapply-form], form#application-form, form',
      ) || doc
    );
  },
  discover(doc, profile) {
    return discoverFormFields(this.findFormRoot(doc), profile);
  },
  autofill(doc, profile, options) {
    return executeFormAutofill(this.findFormRoot(doc), profile, options);
  },
  detectConfirmation(doc) {
    const el = doc.querySelector<HTMLElement>(
      '[data-testid="application-confirmation"], .application-confirmation, [data-application-submitted="true"]',
    );
    if (el?.textContent?.trim()) {
      return { confirmed: true, text: el.textContent.trim() };
    }
    return { confirmed: false };
  },
};
