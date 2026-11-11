import { MIN_FOR_RATES, pipelineStats, type Application } from "./model";

/** Data-backed charts drawn from the same records as the board. Rates need enough data to mean something. */
export function Charts({ items }: { items: Application[] }) {
  const s = pipelineStats(items);
  const maxStage = Math.max(1, ...s.byStage.map((x) => x.count));
  const maxWeek = Math.max(1, ...s.weekly.map((x) => x.count));
  const insufficient = (what: string) => `Not enough data yet. ${what} needs at least ${MIN_FOR_RATES} submitted applications (you have ${s.applied}).`;
  return (
    <div className="tk-charts" data-testid="charts">
      <section className="jb-panel" aria-labelledby="ch-stage">
        <h3 id="ch-stage">Applications by stage</h3>
        <ul className="tk-bars" data-testid="chart-stages">{s.byStage.map((x) => <li key={x.stage}><span>{x.stage}</span><div className="tk-bar"><i style={{ width: `${(x.count / maxStage) * 100}%` }} /></div><strong>{x.count}</strong></li>)}</ul>
      </section>
      <section className="jb-panel" aria-labelledby="ch-week">
        <h3 id="ch-week">Weekly application activity</h3>
        <div className="tk-cols" role="img" aria-label={`Applications per week for the last 8 weeks: ${s.weekly.map((w) => w.count).join(", ")}`} data-testid="chart-weekly">
          {s.weekly.map((w) => <div key={w.weekStart} className="tk-col-chart"><i style={{ height: `${(w.count / maxWeek) * 100}%` }} title={`${w.count} in week of ${w.weekStart}`} /><small>{w.weekStart.slice(5)}</small></div>)}
        </div>
        <p className="jb-muted">Counts submitted applications by their application date. Records without a date aren’t counted.</p>
      </section>
      <section className="jb-panel" aria-labelledby="ch-conv">
        <h3 id="ch-conv">Interview conversion</h3>
        {s.interviewRate ? <p className="tk-big" data-testid="interview-rate">{s.interviewRate.value}%<small> of {s.interviewRate.of} applications reached an interview</small></p> : <p className="jb-muted" data-testid="interview-rate">{insufficient("A conversion rate")}</p>}
      </section>
      <section className="jb-panel" aria-labelledby="ch-resp">
        <h3 id="ch-resp">Response rate</h3>
        {s.responseRate ? <p className="tk-big" data-testid="response-rate">{s.responseRate.value}%<small> of {s.responseRate.of} applications have a recorded response</small></p> : <p className="jb-muted" data-testid="response-rate">{insufficient("A response rate")}</p>}
        <p className="jb-muted">Based on each application’s current status, not on response dates.</p>
      </section>
    </div>
  );
}
