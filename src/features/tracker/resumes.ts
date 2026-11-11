import { loadVersions } from "../resume/model/storage";
import type { ResumeVersion } from "../resume/model/types";

/** Read-only view of the existing résumé library. Never creates a sample résumé. */
export function loadResumeVersionsSafe(): ResumeVersion[] {
  try {
    return loadVersions();
  } catch {
    return [];
  }
}
