import type { Resume, SectionKey } from "../model/types";
import { sectionLabel } from "../layout/engine";

/** Display title for a section key, including custom sections. */
export function sectionTitle(key: SectionKey, resume: Resume) {
  return sectionLabel(key, resume);
}
