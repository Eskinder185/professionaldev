import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { Radar as RadarIcon } from "lucide-react";
import { ApiError, getSkillFit, type ApplicationSummary, type SkillFit } from "./api";
import ConnectionCard from "./ConnectionCard";

export const MIN_AXES_FOR_RADAR = 3;

export interface RadarPoint {
  term: string;
  target: number;
  mine: number;
  rated: boolean;
}

/** Chart rows from the API's axes. An unrated skill is drawn at 0 but flagged, never presented as a measured score. */
export function toRadarData(fit: SkillFit): RadarPoint[] {
  return fit.axes.map((a) => ({ term: a.term, target: a.target, mine: a.has_rating ? a.proficiency : 0, rated: a.has_rating }));
}

export function describeFit(fit: SkillFit): string {
  const s = fit.summary;
  if (!s.required_total) return "This job has no required skills saved.";
  const base = `You meet the target on ${s.required_meeting_target} of ${s.required_total} required skills.`;
  const unrated = s.required_total - s.required_rated;
  return unrated > 0 ? `${base} ${unrated} required skill${unrated === 1 ? " isn’t" : "s aren’t"} rated yet, so they count as not met.` : base;
}

function RadarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: RadarPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="lab-tooltip" role="presentation">
      <strong>{p.term}</strong>
      <div>Target: {p.target}/5</div>
      <div>{p.rated ? `You: ${p.mine}/5` : "You: not rated yet"}</div>
    </div>
  );
}

export default function SkillGapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationSummary[] | null>(null);
  const [fit, setFit] = useState<SkillFit | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!applications || !id || !/^\d+$/.test(id)) {
      setFit(null);
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    getSkillFit(Number(id), controller.signal)
      .then((data) => {
        setFit(data);
        setStatus("idle");
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setFit(null);
        setStatus("error");
        setError(e instanceof ApiError ? e.message : "Couldn’t load the skill comparison.");
      });
    return () => controller.abort();
  }, [applications, id]);

  const data = useMemo(() => (fit ? toRadarData(fit) : []), [fit]);
  const enough = data.length >= MIN_AXES_FOR_RADAR;

  return (
    <div className="career-feature lab-page" data-testid="skill-gap">
      <div className="career-feature-header">
        <div>
          <span className="career-overline">HOME LAB</span>
          <h1>Skill-gap radar</h1>
          <p>What a job asks for, against your own skill ratings.</p>
        </div>
      </div>

      <ConnectionCard onConnected={setApplications} onDisconnected={() => { setApplications(null); setFit(null); }} />

      {applications ? (
        <section className="career-panel" aria-labelledby="lab-pick-h">
          <div className="career-panel-heading"><h2 id="lab-pick-h"><RadarIcon size={18} aria-hidden /> Application</h2></div>
          {applications.length === 0 ? (
            <p className="career-muted">There are no applications in your home-lab database yet.</p>
          ) : (
            <label className="lab-pick">
              Compare your skills with
              <select value={id ?? ""} onChange={(e) => navigate(e.target.value ? `/lab/skill-gap/${e.target.value}` : "/lab/skill-gap")} data-testid="skillgap-application">
                <option value="">Choose an application…</option>
                {applications.map((a) => <option key={a.id} value={a.id}>{a.title} · {a.company.name}</option>)}
              </select>
            </label>
          )}
          {status === "loading" ? <p role="status" className="career-muted">Comparing…</p> : null}
          {status === "error" ? <p className="lab-error" role="alert" data-testid="skillgap-error">{error}</p> : null}
        </section>
      ) : null}

      {fit ? (
        <section className="career-panel" aria-labelledby="lab-fit-h" data-testid="skillgap-result">
          <div className="career-panel-heading"><h2 id="lab-fit-h">{fit.title} · {fit.company}</h2></div>
          <p data-testid="skillgap-summary"><strong>{describeFit(fit)}</strong></p>

          {data.length === 0 ? (
            <div className="career-empty compact" data-testid="skillgap-empty">
              <h3>No requirements saved for this job</h3>
              <p>Save its requirements to the API first (see apps/careeros-api/README.md), then come back.</p>
            </div>
          ) : !enough ? (
            <p className="career-muted" data-testid="skillgap-too-few">A radar needs at least {MIN_AXES_FOR_RADAR} skills. The comparison is in the table below.</p>
          ) : (
            <div className="lab-radar" role="img" aria-label={`Radar chart comparing your proficiency with the target on ${data.length} skills. ${describeFit(fit)} A table with the same numbers follows.`} data-testid="skillgap-chart">
              <ResponsiveContainer width="100%" height={380}>
                <RadarChart data={data} outerRadius="72%">
                  <PolarGrid stroke="var(--career-border)" />
                  <PolarAngleAxis dataKey="term" tick={{ fill: "currentColor", fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fill: "currentColor", fontSize: 10 }} />
                  <Radar name="Target" dataKey="target" stroke="rgb(var(--tw-ink-muted))" fill="rgb(var(--tw-ink-muted))" fillOpacity={0.08} strokeDasharray="5 4" isAnimationActive={false} />
                  <Radar name="You" dataKey="mine" stroke="var(--career-accent)" fill="var(--career-accent)" fillOpacity={0.35} isAnimationActive={false} />
                  <Tooltip content={<RadarTooltip />} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {data.length ? (
            <table className="lab-table" data-testid="skillgap-table">
              <caption className="lab-sr">Skill comparison for {fit.title}</caption>
              <thead><tr><th scope="col">Skill</th><th scope="col">Needed</th><th scope="col">Target</th><th scope="col">You</th><th scope="col">Result</th></tr></thead>
              <tbody>
                {fit.axes.map((a) => (
                  <tr key={a.term}>
                    <th scope="row">{a.term}</th>
                    <td>{a.kind === "required" ? "Required" : "Preferred"}</td>
                    <td>{a.target}/5</td>
                    <td>{a.has_rating ? `${a.proficiency}/5` : "Not rated"}</td>
                    <td>{a.meets_target ? "Meets target" : a.has_rating ? "Below target" : "Rate this skill"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {fit.omitted > 0 ? <p className="career-muted">{fit.omitted} more skill{fit.omitted === 1 ? "" : "s"} not shown to keep the chart readable.</p> : null}
          <p className="career-muted lab-fineprint" data-testid="skillgap-note">{fit.note}</p>
        </section>
      ) : null}
    </div>
  );
}
