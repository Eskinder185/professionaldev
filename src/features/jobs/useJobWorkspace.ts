import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLocal, setLocal } from "../../hooks/useLocal";
import { ensureResumeVersions } from "../autoapply/storage";
import type { ResumeVersion } from "../resume/model/types";
import { analyzePosting, type PostingAnalysis } from "./analysis";
import { queuePostingForAutoApply, trackPosting } from "./pipeline";
import type { JobPosting } from "./schema";
import { dismiss, setFeedback, toggleSaved, useJobStore } from "./store";

const VERSION_KEY = "pd:careeros:jobs:resume-version";

/** Everything the Jobs, Matches and AutoApply surfaces share: one store, one analysis, one set of actions. */
export function useJobWorkspace() {
  const { state, update } = useJobStore();
  const navigate = useNavigate();
  const versions = useMemo<ResumeVersion[]>(() => ensureResumeVersions(), []);
  const [versionId, setVersionIdState] = useState<string>(() => {
    const saved = getLocal<string>(VERSION_KEY, "");
    return versions.find((v) => v.id === saved)?.id ?? (versions.find((v) => v.kind === "master") ?? versions[0])?.id ?? "";
  });
  const version = versions.find((v) => v.id === versionId);
  const cache = useRef(new Map<string, PostingAnalysis | null>());
  const [notice, setNotice] = useState("");

  const setVersionId = useCallback((id: string) => {
    setLocal(VERSION_KEY, id);
    cache.current.clear();
    setVersionIdState(id);
  }, []);

  const analysisFor = useCallback(
    (p: JobPosting): PostingAnalysis | null => {
      const key = `${p.id}|${versionId}|${p.description.length}|${p.skills.length}`;
      if (!cache.current.has(key)) cache.current.set(key, analyzePosting(p, version));
      return cache.current.get(key) ?? null;
    },
    [version, versionId],
  );

  const actions = useMemo(
    () => ({
      toggleSave: (p: JobPosting) => update((s) => toggleSaved(s, p.id)),
      dismiss: (p: JobPosting) => update((s) => dismiss(s, p.id)),
      feedback: (p: JobPosting, v: "like" | "dislike" | "clear") => update((s) => setFeedback(s, p.id, v)),
      track: (p: JobPosting) =>
        update((s) => {
          const r = trackPosting(s, p, versionId);
          setNotice(r.created ? `Added “${p.title}” to your tracker.` : `“${p.title}” is already in your tracker.`);
          return r.state;
        }),
      prepare: (p: JobPosting) => {
        const r = queuePostingForAutoApply(p);
        if (r.error) {
          setNotice(r.error);
          return;
        }
        update((s) => trackPosting(s, p, versionId).state);
        navigate(`/autoapply?focus=${encodeURIComponent(r.item.id)}`);
      },
    }),
    [update, navigate, versionId],
  );

  return { state, update, versions, version, versionId, setVersionId, analysisFor, actions, notice, setNotice };
}

export type JobWorkspace = ReturnType<typeof useJobWorkspace>;
