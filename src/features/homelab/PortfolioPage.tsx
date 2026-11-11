import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Award, Briefcase, ExternalLink, FlaskConical, FolderGit2, Target } from "lucide-react";
import { ApiError, loadPortfolio, loadRoles, type PortfolioData, type PortfolioItem, type PortfolioType, type RoleSummary } from "./api";

const GROUPS: Array<{ type: PortfolioType; title: string; icon: typeof Award }> = [
  { type: "project", title: "Projects", icon: FolderGit2 },
  { type: "lab", title: "Networking & home labs", icon: FlaskConical },
  { type: "certification", title: "Certifications", icon: Award },
  { type: "experience", title: "Experience", icon: Briefcase },
];

const year = (date: string | null) => (date ? date.slice(0, 4) : "");
const span = (item: PortfolioItem) => (item.started_on ? `${year(item.started_on)}${item.ended_on ? `–${year(item.ended_on)}` : "–present"}` : "");

/** Relevance is only shown as emphasis when a role is selected (1-5, from the tagging in the database). */
function Emphasis({ relevance }: { relevance: number }) {
  if (relevance < 4) return null;
  return <span className="lab-pill lab-pill-strong" title="Closely matched to this role">Strong match</span>;
}

function Card({ item, role }: { item: PortfolioItem; role: boolean }) {
  return (
    <li className="lab-card" data-testid="portfolio-item">
      <div className="lab-card-head">
        <h3>{item.title}</h3>
        {role ? <Emphasis relevance={item.relevance} /> : null}
      </div>
      {item.issuer || span(item) ? <p className="career-muted">{[item.issuer, span(item)].filter(Boolean).join(" · ")}</p> : null}
      <p>{item.summary}</p>
      {item.skills.length ? (
        <ul className="lab-tags" aria-label="Skills">
          {item.skills.map((skill) => <li key={skill}>{skill}</li>)}
        </ul>
      ) : null}
      {item.url || item.repo_url ? (
        <p className="lab-links">
          {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">View <ExternalLink size={13} aria-hidden /></a> : null}
          {item.repo_url ? <a href={item.repo_url} target="_blank" rel="noopener noreferrer">Source <ExternalLink size={13} aria-hidden /></a> : null}
        </p>
      ) : null}
    </li>
  );
}

export default function PortfolioPage() {
  const [params] = useSearchParams();
  const role = params.get("role");
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; data: PortfolioData; source: "live" | "snapshot" } | { status: "error"; message: string; kind: string }>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void loadRoles(controller.signal).then(setRoles).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loadPortfolio(role, controller.signal)
      .then(({ data, source }) => setState({ status: "ready", data, source }))
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === "AbortError") return;
        const e = error instanceof ApiError ? error : null;
        setState({ status: "error", message: e?.message ?? "The portfolio couldn’t be loaded.", kind: e?.kind ?? "server" });
      });
    return () => controller.abort();
  }, [role]);

  const current = roles.find((r) => r.slug === role);

  return (
    <div className="career-feature lab-page" data-testid="portfolio-page">
      <div className="career-feature-header">
        <div>
          <span className="career-overline">PORTFOLIO</span>
          <h1>{state.status === "ready" && state.data.role ? `Highlighted for: ${state.data.role.title}` : "Portfolio"}</h1>
          <p>{state.status === "ready" && state.data.role?.description ? state.data.role.description : "Projects, labs and certifications. Pick a role to see only what is relevant to it."}</p>
        </div>
      </div>

      <nav className="lab-roles" aria-label="Choose a role">
        <Link to="/portfolio" className={`lab-role ${!role ? "is-active" : ""}`} aria-current={!role ? "page" : undefined}>Everything</Link>
        {roles.map((r) => (
          <Link key={r.slug} to={`/portfolio?role=${encodeURIComponent(r.slug)}`} className={`lab-role ${role === r.slug ? "is-active" : ""}`} aria-current={role === r.slug ? "page" : undefined}>
            {r.title} <span className="lab-count">{r.item_count}</span>
          </Link>
        ))}
      </nav>

      {state.status === "loading" ? <p className="career-muted" role="status">Loading portfolio…</p> : null}

      {state.status === "error" ? (
        <div className="career-empty" role="alert" data-testid="portfolio-error">
          <div className="career-empty-icon"><Target size={22} aria-hidden /></div>
          <h3>{state.kind === "not_found" ? "No view for that role" : "Nothing to show yet"}</h3>
          <p>{state.message}</p>
          {role ? <Link className="career-text-link" to="/portfolio">See everything</Link> : null}
        </div>
      ) : null}

      {state.status === "ready" ? (
        <>
          <p className="lab-source" data-testid="portfolio-source">
            {state.data.total} item{state.data.total === 1 ? "" : "s"}
            {current || state.data.role ? ` relevant to ${state.data.role?.title ?? current?.title}` : ""} ·{" "}
            {state.source === "live" ? "live from the home-lab API" : "published snapshot"}
            {state.data.generated_at ? ` (${new Date(state.data.generated_at).toLocaleDateString()})` : ""}
          </p>
          {state.data.total === 0 ? (
            <div className="career-empty" data-testid="portfolio-empty">
              <h3>Nothing published for this role yet</h3>
              <p>Items appear here once they are tagged for the role and marked published.</p>
            </div>
          ) : null}
          {GROUPS.map(({ type, title, icon: Icon }) => {
            const items = state.data.groups[type] ?? [];
            if (!items.length) return null;
            return (
              <section key={type} className="career-panel" aria-labelledby={`g-${type}`} data-testid={`portfolio-group-${type}`}>
                <div className="career-panel-heading"><h2 id={`g-${type}`}><Icon size={18} aria-hidden /> {title}</h2><span className="career-muted">{items.length}</span></div>
                <ul className="lab-cards">{items.map((item) => <Card key={item.slug} item={item} role={Boolean(state.data.role)} />)}</ul>
              </section>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
