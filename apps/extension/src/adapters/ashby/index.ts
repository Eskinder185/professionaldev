import {
  discoverFormFields,
  executeFormAutofill,
  PLATFORM_ADAPTERS,
} from "../../../../../packages/careeros-shared/adapters";
import type { RuntimePlatformAdapter } from "../generic";

export const ashbyAdapter: RuntimePlatformAdapter = {
  id: "ashby",
  label: PLATFORM_ADAPTERS.ashby.label,
  supportLevel: "partial",
  matches(url, doc) {
    if (/jobs\.ashbyhq\.com/i.test(url) || /[?&]platform=ashby\b/i.test(url)) return true;
    return Boolean(doc?.querySelector("[data-platform='ashby']"));
  },
  findFormRoot(doc) {
    return doc.querySelector<HTMLElement>("[data-platform='ashby'], form") || doc;
  },
  discover(doc, profile) {
    return discoverFormFields(this.findFormRoot(doc), profile);
  },
  autofill(doc, profile, options) {
    return executeFormAutofill(this.findFormRoot(doc), profile, options);
  },
  detectConfirmation(doc) {
    const el = doc.querySelector<HTMLElement>("[data-testid='application-confirmation'], .application-confirmation");
    if (el?.textContent?.trim()) return { confirmed: true, text: el.textContent.trim() };
    return { confirmed: false };
  },
};
