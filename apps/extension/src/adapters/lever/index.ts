import {
  discoverFormFields,
  executeFormAutofill,
  PLATFORM_ADAPTERS,
} from "../../../../../packages/careeros-shared/adapters";
import type { RuntimePlatformAdapter } from "../generic";

export const leverAdapter: RuntimePlatformAdapter = {
  id: "lever",
  label: PLATFORM_ADAPTERS.lever.label,
  supportLevel: "supported",
  matches(url, doc) {
    if (/jobs\.lever\.co/i.test(url) || /[?&]platform=lever\b/i.test(url)) return true;
    return Boolean(doc?.querySelector(".application-form[data-platform='lever'], [data-platform='lever']"));
  },
  findFormRoot(doc) {
    return doc.querySelector<HTMLElement>("[data-platform='lever'], .application-form, form") || doc;
  },
  discover(doc, profile) {
    // Lever uses fullName (`name="name"`) and `name="org"` for current company
    const enrichedProfile = profile
      ? {
          ...profile,
          values: {
            ...profile.values,
            fullName:
              profile.values.fullName ||
              [profile.values.firstName, profile.values.lastName].filter(Boolean).join(" ").trim(),
          },
        }
      : profile;
    return discoverFormFields(this.findFormRoot(doc), enrichedProfile);
  },
  autofill(doc, profile, options) {
    const enrichedProfile = {
      ...profile,
      values: {
        ...profile.values,
        fullName:
          profile.values.fullName ||
          [profile.values.firstName, profile.values.lastName].filter(Boolean).join(" ").trim(),
      },
    };
    return executeFormAutofill(this.findFormRoot(doc), enrichedProfile, options);
  },
  detectConfirmation(doc) {
    const el = doc.querySelector<HTMLElement>(
      "[data-testid='application-confirmation'], .application-confirmation, .posting-confirmation",
    );
    if (el?.textContent?.trim()) {
      return { confirmed: true, text: el.textContent.trim() };
    }
    return { confirmed: false };
  },
};
