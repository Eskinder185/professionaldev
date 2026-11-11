import { createContext, useContext } from "react";
import type { ExtensionPersistentState } from "../../../src/storage/stateStore";
import type { AutoApplyQueueItem, PageContext } from "../../../../../packages/careeros-shared/types";
import type { PageReadResult, TargetTab, UiPrefs } from "./bridge";

export interface Model {
  state: ExtensionPersistentState | null;
  tab: TargetTab | null;
  read: PageReadResult | null;
  /** Always set after the first read: the real context, or a URL-only fallback. */
  page: PageContext | null;
  readable: boolean;
  app: AutoApplyQueueItem | null;
  ui: UiPrefs;
  updateUi: (patch: Partial<UiPrefs> | ((prev: UiPrefs) => Partial<UiPrefs>)) => void;
  refresh: () => Promise<void>;
  loading: boolean;
  base: string;
}

export const ModelContext = createContext<Model | null>(null);

export function useModel(): Model {
  const m = useContext(ModelContext);
  if (!m) throw new Error("ModelContext missing");
  return m;
}
