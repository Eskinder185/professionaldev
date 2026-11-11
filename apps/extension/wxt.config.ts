/**
 * WXT / Manifest V3 configuration for CareerOS AutoApply.
 * Uses minimal browser permissions (activeTab, scripting, storage, sidePanel)
 * and restricts externally_connectable to CareerOS origins.
 */
export default {
  manifestVersion: 3,
  name: "CareerOS AutoApply",
  version: "1.0.0",
  description:
    "Apply to more relevant jobs with less repetitive typing. Connects to ProfessionalDev CareerOS with full user review before any submission.",
  permissions: ["activeTab", "scripting", "storage", "sidePanel"],
  optional_host_permissions: [
    "https://boards.greenhouse.io/*",
    "https://job-boards.greenhouse.io/*",
    "https://jobs.lever.co/*",
    "https://jobs.ashbyhq.com/*",
    "https://*.myworkdayjobs.com/*"
  ],
  externally_connectable: {
    matches: [
      "https://eskinder185.github.io/professionaldev/*",
      "http://127.0.0.1/*",
      "http://localhost/*"
    ]
  }
};
