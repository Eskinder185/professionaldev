import { validateAndAnalyzeJobUrl } from "../../../../packages/careeros-shared/schemas";
import { genericAdapter, type RuntimePlatformAdapter } from "./generic";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ashbyAdapter } from "./ashby";
import { workdayAdapter } from "./workday";

const ORDERED_ADAPTERS: RuntimePlatformAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  workdayAdapter,
  genericAdapter,
];

export function selectPlatformAdapter(url: string, doc?: Document | HTMLElement): RuntimePlatformAdapter {
  const parsed = validateAndAnalyzeJobUrl(url);
  if (parsed.ok && parsed.platform === "unsupported") {
    return {
      ...genericAdapter,
      id: "unsupported",
      label: "Unsupported / Gated Platform",
      supportLevel: "unsupported",
      discover() {
        return [];
      },
      autofill() {
        return {
          fields: [],
          filledCount: 0,
          skippedSensitiveCount: 0,
          missingCount: 0,
          unsupportedCount: 0,
          pageStage: "user_review_required",
        };
      },
    };
  }

  for (const adapter of ORDERED_ADAPTERS) {
    if (adapter.id !== "generic" && adapter.matches(url, doc)) {
      return adapter;
    }
  }
  return genericAdapter;
}

export { genericAdapter, greenhouseAdapter, leverAdapter, ashbyAdapter, workdayAdapter };
