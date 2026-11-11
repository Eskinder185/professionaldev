import {
  discoverFormFields,
  executeFormAutofill,
  PLATFORM_ADAPTERS,
} from "../../../../../packages/careeros-shared/adapters";
import type { RuntimePlatformAdapter } from "../generic";

export const greenhouseAdapter: RuntimePlatformAdapter = {
  id: "greenhouse",
  label: PLATFORM_ADAPTERS.greenhouse.label,
  supportLevel: "supported",
  matches(url, doc) {
    if (/greenhouse\.io/i.test(url) || /[?&]platform=greenhouse\b/i.test(url)) return true;
    return Boolean(doc?.querySelector("#application_form, #greenhouse_application, [data-platform='greenhouse']"));
  },
  findFormRoot(doc) {
    return (
      doc.querySelector<HTMLElement>("#application_form, #greenhouse_application, [data-platform='greenhouse'], form") ||
      doc
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
      "#application_confirmation, [data-testid='application-confirmation'], .application-confirmation",
    );
    if (el?.textContent?.trim()) {
      return { confirmed: true, text: el.textContent.trim() };
    }
    return { confirmed: false };
  },
};
