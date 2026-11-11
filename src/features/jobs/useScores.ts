import { useEffect, useState } from "react";
import type { JobPosting } from "./schema";
import type { JobWorkspace } from "./useJobWorkspace";

/**
 * Scores postings with the match engine in small idle chunks, so a 600-listing board never blocks
 * typing or scrolling. Unscored postings sort after scored ones until their turn comes.
 */
export function useScores(postings: JobPosting[], ws: JobWorkspace, limit = 300): { scores: Map<string, number | null>; pending: boolean } {
  const [scores, setScores] = useState<Map<string, number | null>>(new Map());
  const [pending, setPending] = useState(false);
  const { analysisFor, versionId } = ws;
  const key = postings.slice(0, limit).map((p) => p.id).join("|") + versionId;

  useEffect(() => {
    let cancelled = false;
    const queue = postings.slice(0, limit);
    const next = new Map<string, number | null>();
    setPending(queue.length > 0);
    let i = 0;
    const step = () => {
      if (cancelled) return;
      const end = Math.min(i + 20, queue.length);
      for (; i < end; i++) next.set(queue[i].id, analysisFor(queue[i])?.score ?? null);
      setScores(new Map(next));
      if (i < queue.length) setTimeout(step, 0);
      else setPending(false);
    };
    setTimeout(step, 0);
    return () => {
      cancelled = true;
    };
    // `key` encodes the posting ids and version; `postings` identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, analysisFor]);

  return { scores, pending };
}
