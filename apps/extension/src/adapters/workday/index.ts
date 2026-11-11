import {
  discoverFormFields,
  executeFormAutofill,
  PLATFORM_ADAPTERS,
} from "../../../../../packages/careeros-shared/adapters";
import type { RuntimePlatformAdapter } from "../generic";

export const workdayAdapter: RuntimePlatformAdapter = {
  id: "workday",
  label: PLATFORM_ADAPTERS.workday.label,
  supportLevel: "partial",
  matches(url, doc) {
    if (/myworkdayjobs\.com/i.test(url) || /[?&]platform=workday\b/i.test(url)) return true;
    return Boolean(doc?.querySelector("[data-platform='workday']"));
  },
  findFormRoot(doc) {
    return doc.querySelector<HTMLElement>("[data-platform='workday'], form") || doc;
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
