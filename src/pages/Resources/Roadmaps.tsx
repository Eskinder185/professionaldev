import { useEffect, useState } from "react";
import SectionHeader from "../../components/SectionHeader";
import { ApiClientError } from "../../lib/api/http";
import { listRoadmaps } from "../../lib/api/roadmaps";
import type { RoadmapResponse } from "../../lib/api/types";

const JAVA_ROADMAP_ID = "java-spring-backend";

type RoadmapState =
  | { status: "loading" }
  | { status: "success"; roadmap: RoadmapResponse | null }
  | { status: "error"; message: string };

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError)) {
    return "The roadmap could not be loaded. Please try again.";
  }

  switch (error.kind) {
    case "network":
      return "The Spring Boot API is unavailable. Start it locally, then try again.";
    case "server":
      return "The roadmap service reported a server error. Please try again.";
    case "malformed-response":
      return "The roadmap service returned an unexpected response.";
    default:
      return error.message;
  }
}

export default function Roadmaps() {
  const [requestNumber, setRequestNumber] = useState(0);
  const [state, setState] = useState<RoadmapState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    listRoadmaps({ signal: controller.signal })
      .then((roadmaps) => {
        const roadmap = roadmaps.find(({ id }) => id === JAVA_ROADMAP_ID) ?? null;
        setState({ status: "success", roadmap });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiClientError && error.kind === "aborted") return;
        setState({ status: "error", message: errorMessage(error) });
      });

    return () => controller.abort();
  }, [requestNumber]);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      <SectionHeader title="Certification Roadmaps" subtitle="AWS SAA | Security+ | Java and Spring" />

      <section aria-labelledby="existing-roadmaps-heading" className="space-y-4">
        <div>
          <h2 id="existing-roadmaps-heading" className="text-xl font-semibold text-ink dark:text-white">
            Existing certification guides
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Static guides included with Roadmap to Role.</p>
        </div>

        <details className="rounded-xl border p-4">
          <summary className="font-semibold">AWS Solutions Architect - Associate</summary>
          <ul className="mt-2 list-disc pl-6">
            <li>Core: IAM, VPC, EC2, S3, RDS, Route53</li>
            <li>Hands-on: VPC + EC2 lab, S3 static hosting</li>
            <li>Practice: TD exams, whitepapers</li>
          </ul>
        </details>
        <details className="rounded-xl border p-4">
          <summary className="font-semibold">CompTIA Security+</summary>
          <ul className="mt-2 list-disc pl-6">
            <li>Domains: Threats, Architecture, Ops, Governance</li>
            <li>Labs: SIEM basics, Wireshark captures</li>
          </ul>
        </details>
      </section>

      <section aria-labelledby="api-roadmap-heading" className="border-t border-black/[0.08] pt-8 dark:border-white/[0.1]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Live API catalog</p>
          <h2 id="api-roadmap-heading" className="mt-2 text-xl font-semibold text-ink dark:text-white">
            Java and Spring Backend
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            This read-only sample comes from the local Spring Boot service. It does not change certification progress or
            other browser-stored data.
          </p>
        </div>

        <div className="mt-6" aria-live="polite">
          {state.status === "loading" && (
            <p role="status" className="rounded-xl border border-black/[0.08] p-5 text-sm text-ink-muted dark:border-white/[0.1]">
              Loading the Java and Spring roadmap...
            </p>
          )}

          {state.status === "error" && (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30">
              <p className="font-semibold text-ink dark:text-white">API roadmap unavailable</p>
              <p className="mt-1 text-sm text-ink-muted">{state.message}</p>
              <button
                type="button"
                className="btn btn-primary mt-4 min-h-10 px-5 text-sm font-semibold"
                onClick={() => setRequestNumber((current) => current + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {state.status === "success" && state.roadmap === null && (
            <p role="status" className="rounded-xl border border-black/[0.08] p-5 text-sm text-ink-muted dark:border-white/[0.1]">
              The Java and Spring roadmap is not currently available in the API catalog.
            </p>
          )}

          {state.status === "success" && state.roadmap !== null && (
            <article className="rounded-xl border border-black/[0.08] p-5 dark:border-white/[0.1] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-ink dark:text-white">{state.roadmap.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{state.roadmap.description}</p>
                </div>
                <p className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-semibold text-ink-muted dark:bg-white/[0.08]">
                  {state.roadmap.estimatedWeeks} weeks
                </p>
              </div>
              <p className="mt-4 text-sm">
                <span className="font-semibold text-ink dark:text-white">Target role:</span>{" "}
                <span className="text-ink-muted">{state.roadmap.targetRole}</span>
              </p>
              <ol className="mt-6 space-y-5">
                {state.roadmap.stages.map((stage) => (
                  <li key={stage.sequence} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/[0.1] text-sm font-semibold dark:border-white/[0.15]">
                      {stage.sequence}
                    </span>
                    <div>
                      <h4 className="font-semibold text-ink dark:text-white">{stage.title}</h4>
                      <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed text-ink-muted">
                        {stage.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
                      </ul>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
