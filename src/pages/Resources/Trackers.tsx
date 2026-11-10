import { useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const split = (line: string) =>
    line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'));
  const headers = split(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = split(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  const esc = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n");
  return [head, body].join("\n");
}

type Skill = { skill: string; level: number; hours: number; notes: string; lastPracticed?: string };
type AppRow = { company: string; role: string; link: string; status: string; nextAction: string; due?: string; remind?: boolean };

const STATUS_OPTS = ["Applied", "Phone Screen", "Interview", "Offer", "Rejected"] as const;

export default function Trackers() {
  const [tab, setTab] = useState<"skills" | "apps">("skills");

  const [skills, setSkills] = useState<Skill[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("pd:resources:skills:list") || "[]");
    } catch {
      return [];
    }
  });
  const [sd, setSd] = useState<Skill>({ skill: "", level: 3, hours: 1, notes: "" });

  const saveSkills = (arr: Skill[]) => {
    setSkills(arr);
    localStorage.setItem("pd:resources:skills:list", JSON.stringify(arr));
  };

  const totalHours = useMemo(() => skills.reduce((s, x) => s + (Number(x.hours) || 0), 0), [skills]);
  const avgLevel = useMemo(
    () => (skills.length ? Math.round((skills.reduce((s, x) => s + (Number(x.level) || 0), 0) / skills.length) * 10) / 10 : 0),
    [skills],
  );

  const exportSkills = () => {
    const csv = toCSV(skills as unknown as Record<string, unknown>[], ["skill", "level", "hours", "notes", "lastPracticed"]);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skills.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSkills = async (file: File) => {
    const text = await file.text();
    const data = parseCSV(text);
    saveSkills(
      data.map((r) => ({
        skill: r.skill || "",
        level: Number(r.level) || 0,
        hours: Number(r.hours) || 0,
        notes: r.notes || "",
        lastPracticed: r.lastPracticed || "",
      })),
    );
  };

  const [apps, setApps] = useState<AppRow[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("pd:resources:apps:list") || "[]");
    } catch {
      return [];
    }
  });
  const [ad, setAd] = useState<AppRow>({
    company: "",
    role: "",
    link: "",
    status: "Applied",
    nextAction: "",
    due: "",
    remind: false,
  });
  const [filter, setFilter] = useState<string>("all");

  const saveApps = (arr: AppRow[]) => {
    setApps(arr);
    localStorage.setItem("pd:resources:apps:list", JSON.stringify(arr));
  };

  const exportApps = () => {
    const csv = toCSV(apps as unknown as Record<string, unknown>[], ["company", "role", "link", "status", "nextAction", "due"]);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "applications.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importApps = async (file: File) => {
    const text = await file.text();
    const data = parseCSV(text);
    saveApps(
      data.map((r) => ({
        company: r.company || "",
        role: r.role || "",
        link: r.link || "",
        status: r.status || "Applied",
        nextAction: r.nextAction || "",
        due: r.due || "",
      })),
    );
  };

  const filtered = apps.filter((a) => (filter === "all" ? true : a.status === filter));

  return (
    <div className="space-y-8 pb-6">
      <PageHeader
        eyebrow="Grow"
        title="Trackers"
        sub="Skills practice log and a lightweight applications CRM. Data stays in your browser; use CSV to move rows in or out."
      />

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Tracker sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "skills"}
          id="tab-skills"
          aria-controls="panel-skills"
          className={tab === "skills" ? "btn btn-primary min-h-10 px-4" : "btn surface-muted min-h-10 px-4"}
          onClick={() => setTab("skills")}
        >
          Skills
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "apps"}
          id="tab-apps"
          aria-controls="panel-apps"
          className={tab === "apps" ? "btn btn-primary min-h-10 px-4" : "btn surface-muted min-h-10 px-4"}
          onClick={() => setTab("apps")}
        >
          Applications
        </button>
      </div>

      {tab === "skills" ? (
        <div id="panel-skills" role="tabpanel" aria-labelledby="tab-skills" className="space-y-6">
          <section className="border-t border-black/[0.07] py-8 dark:border-white/[0.09] sm:py-10">
            <h2 className="text-title-sm text-ink dark:text-white">Add skill</h2>
            <p className="mt-1 text-sm text-ink-muted">New rows append to the table below.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
              <label className="space-y-1 sm:col-span-2">
                <span className="text-caption font-medium text-ink-muted">Skill</span>
                <input
                  aria-label="Skill name"
                  className="input min-h-11"
                  placeholder="e.g. TypeScript"
                  value={sd.skill}
                  onChange={(e) => setSd({ ...sd, skill: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-caption font-medium text-ink-muted">Level 1–5</span>
                <input
                  aria-label="Skill level"
                  type="number"
                  min={1}
                  max={5}
                  className="input min-h-11"
                  value={sd.level}
                  onChange={(e) => setSd({ ...sd, level: Number(e.target.value) })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-caption font-medium text-ink-muted">Hours</span>
                <input
                  aria-label="Practice hours"
                  type="number"
                  min={0}
                  className="input min-h-11"
                  value={sd.hours}
                  onChange={(e) => setSd({ ...sd, hours: Number(e.target.value) })}
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-caption font-medium text-ink-muted">Notes</span>
                <input
                  aria-label="Skill notes"
                  className="input min-h-11"
                  placeholder="Optional"
                  value={sd.notes}
                  onChange={(e) => setSd({ ...sd, notes: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary min-h-11 w-full lg:w-auto lg:shrink-0"
                onClick={() => saveSkills([...skills, sd])}
              >
                Add row
              </button>
            </div>

            <div className="mt-6 -mx-1 overflow-x-auto border-y border-black/[0.07] dark:border-white/10">
              <table className="min-w-[640px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-black/[0.08] bg-canvas-subtle/80 dark:border-white/10 dark:bg-white/[0.04]">
                    <th className="px-3 py-2.5 font-semibold text-ink dark:text-white">Skill</th>
                    <th className="px-3 py-2.5 font-semibold text-ink dark:text-white">Level</th>
                    <th className="px-3 py-2.5 font-semibold text-ink dark:text-white">Hours</th>
                    <th className="px-3 py-2.5 font-semibold text-ink dark:text-white">Notes</th>
                    <th className="px-3 py-2.5 font-semibold text-ink dark:text-white">Last</th>
                    <th className="relative px-3 py-2.5 font-semibold text-ink dark:text-white">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {skills.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-sm text-ink-muted">
                        No skills yet — add your first row above.
                      </td>
                    </tr>
                  ) : (
                    skills.map((s, i) => (
                      <tr key={i} className="border-b border-black/[0.06] dark:border-white/[0.08]">
                        <td className="p-2 align-top">
                          <input
                            className="input min-h-10 border-0 bg-transparent py-2 shadow-none focus-visible:ring-1"
                            value={s.skill}
                            onChange={(e) => {
                              const copy = [...skills];
                              copy[i].skill = e.target.value;
                              saveSkills(copy);
                            }}
                            aria-label={`Skill ${i + 1} name`}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="number"
                            min={1}
                            max={5}
                            className="input min-h-10 w-20 border-0 bg-transparent py-2 shadow-none"
                            value={s.level}
                            onChange={(e) => {
                              const copy = [...skills];
                              copy[i].level = Number(e.target.value);
                              saveSkills(copy);
                            }}
                            aria-label={`Skill ${i + 1} level`}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="number"
                            className="input min-h-10 w-24 border-0 bg-transparent py-2 shadow-none"
                            value={s.hours}
                            onChange={(e) => {
                              const copy = [...skills];
                              copy[i].hours = Number(e.target.value);
                              saveSkills(copy);
                            }}
                            aria-label={`Skill ${i + 1} hours`}
                          />
                        </td>
                        <td className="min-w-[8rem] p-2 align-top">
                          <input
                            className="input min-h-10 w-full min-w-[120px] border-0 bg-transparent py-2 shadow-none"
                            value={s.notes}
                            onChange={(e) => {
                              const copy = [...skills];
                              copy[i].notes = e.target.value;
                              saveSkills(copy);
                            }}
                            aria-label={`Skill ${i + 1} notes`}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="date"
                            className="input min-h-10 border-0 bg-transparent py-2 shadow-none"
                            value={s.lastPracticed || ""}
                            onChange={(e) => {
                              const copy = [...skills];
                              copy[i].lastPracticed = e.target.value;
                              saveSkills(copy);
                            }}
                            aria-label={`Skill ${i + 1} last practiced`}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <button
                            type="button"
                            className="btn surface-muted min-h-9 px-2 text-sm text-red-600 dark:text-red-400"
                            onClick={() => saveSkills(skills.filter((_, j) => j !== i))}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn surface-muted min-h-10 px-4" onClick={exportSkills}>
                Export CSV
              </button>
              <label className="btn surface-muted min-h-10 cursor-pointer px-4">
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importSkills(f);
                  }}
                />
              </label>
            </div>
          </section>

          <section className="border-t border-black/[0.07] py-8 dark:border-white/[0.09] sm:py-10">
            <p className="text-sm text-ink-muted">
              <span className="font-medium text-ink dark:text-white">Total hours:</span> {totalHours}{" "}
              <span className="mx-2 text-ink-faint" aria-hidden>
                ·
              </span>
              <span className="font-medium text-ink dark:text-white">Avg level:</span> {avgLevel}
            </p>
            <div className="mt-4 h-56 w-full min-w-0 sm:h-64">
              <InlineBarChart data={skills} xKey="skill" yKey="hours" />
            </div>
          </section>
        </div>
      ) : (
        <div id="panel-apps" role="tabpanel" aria-labelledby="tab-apps" className="space-y-6">
          <section className="border-t border-black/[0.07] py-8 dark:border-white/[0.09] sm:py-10">
            <h2 className="text-title-sm text-ink dark:text-white">Add application</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end">
              <label className="space-y-1 xl:col-span-1">
                <span className="text-caption font-medium text-ink-muted">Company</span>
                <input
                  className="input min-h-11"
                  placeholder="Company"
                  value={ad.company}
                  onChange={(e) => setAd({ ...ad, company: e.target.value })}
                />
              </label>
              <label className="space-y-1 xl:col-span-1">
                <span className="text-caption font-medium text-ink-muted">Role</span>
                <input
                  className="input min-h-11"
                  placeholder="Role"
                  value={ad.role}
                  onChange={(e) => setAd({ ...ad, role: e.target.value })}
                />
              </label>
              <label className="space-y-1 md:col-span-2 xl:col-span-1">
                <span className="text-caption font-medium text-ink-muted">Link</span>
                <input
                  className="input min-h-11"
                  placeholder="https://…"
                  value={ad.link}
                  onChange={(e) => setAd({ ...ad, link: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-caption font-medium text-ink-muted">Status</span>
                <select
                  className="input min-h-11"
                  value={ad.status}
                  onChange={(e) => setAd({ ...ad, status: e.target.value })}
                >
                  {STATUS_OPTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-caption font-medium text-ink-muted">Next action</span>
                <input
                  className="input min-h-11"
                  placeholder="Follow up, prep, etc."
                  value={ad.nextAction}
                  onChange={(e) => setAd({ ...ad, nextAction: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-caption font-medium text-ink-muted">Due</span>
                <input
                  type="date"
                  className="input min-h-11"
                  value={ad.due || ""}
                  onChange={(e) => setAd({ ...ad, due: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button type="button" className="btn btn-primary min-h-11 px-5" onClick={() => saveApps([ad, ...apps])}>
                Add application
              </button>
              <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
                <label htmlFor="app-status-filter" className="sr-only">
                  Filter by status
                </label>
                <select
                  id="app-status-filter"
                  className="input min-h-11 w-full min-w-[10rem] sm:w-auto"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {["all", ...STATUS_OPTS].map((s) => (
                    <option key={s} value={s}>
                      {s === "all" ? "All statuses" : s}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn surface-muted min-h-11 px-4" onClick={exportApps}>
                  Export CSV
                </button>
                <label className="btn surface-muted min-h-11 cursor-pointer px-4">
                  Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importApps(f);
                    }}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="border-t border-black/[0.07] py-8 dark:border-white/[0.09] sm:py-10">
            <div className="-mx-1 overflow-x-auto border-y border-black/[0.07] dark:border-white/10">
              <table className="min-w-[720px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-black/[0.08] bg-canvas-subtle/80 dark:border-white/10 dark:bg-white/[0.04]">
                    <th className="px-3 py-2.5 font-semibold text-ink dark:text-white">Company</th>
                    <th className="px-3 py-2.5 font-semibold text-ink dark:text-white">Role</th>
                    <th className="px-3 py-2.5 font-semibold text-ink dark:text-white">Link</th>
                    <th className="px-3 py-2.5 font-semibold text-ink dark:text-white">Status</th>
                    <th className="px-3 py-2.5 font-semibold text-ink dark:text-white">Next</th>
                    <th className="px-3 py-2.5 font-semibold text-ink dark:text-white">Due</th>
                    <th className="relative px-3 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-ink-muted">
                        No applications match this filter.
                      </td>
                    </tr>
                  ) : (
                    filtered
                      .map((r) => ({ r, i: apps.indexOf(r) }))
                      .filter((x): x is { r: AppRow; i: number } => x.i >= 0)
                      .map(({ r, i }) => {
                      const soon = r.due ? Math.ceil((new Date(r.due).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 3 : false;
                      return (
                        <tr
                          key={i}
                          className={
                            soon
                              ? "border-b border-black/[0.06] bg-amber-500/[0.08] dark:border-white/[0.08]"
                              : "border-b border-black/[0.06] dark:border-white/[0.08]"
                          }
                        >
                          <td className="p-2 align-top">
                            <input
                              className="input min-h-10 border-0 bg-transparent py-2 shadow-none"
                              value={r.company}
                              onChange={(e) => {
                                const copy = [...apps];
                                copy[i].company = e.target.value;
                                saveApps(copy);
                              }}
                              aria-label={`Application ${i + 1} company`}
                            />
                          </td>
                          <td className="p-2 align-top">
                            <input
                              className="input min-h-10 border-0 bg-transparent py-2 shadow-none"
                              value={r.role}
                              onChange={(e) => {
                                const copy = [...apps];
                                copy[i].role = e.target.value;
                                saveApps(copy);
                              }}
                              aria-label={`Application ${i + 1} role`}
                            />
                          </td>
                          <td className="min-w-[6rem] p-2 align-top">
                            <input
                              className="input min-h-10 w-full min-w-[140px] border-0 bg-transparent py-2 shadow-none"
                              value={r.link}
                              onChange={(e) => {
                                const copy = [...apps];
                                copy[i].link = e.target.value;
                                saveApps(copy);
                              }}
                              aria-label={`Application ${i + 1} link`}
                            />
                          </td>
                          <td className="p-2 align-top">
                            <select
                              className="input min-h-10 border-0 bg-transparent py-2 shadow-none"
                              value={r.status}
                              onChange={(e) => {
                                const copy = [...apps];
                                copy[i].status = e.target.value;
                                saveApps(copy);
                              }}
                              aria-label={`Application ${i + 1} status`}
                            >
                              {STATUS_OPTS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="min-w-[6rem] p-2 align-top">
                            <input
                              className="input min-h-10 w-full min-w-[120px] border-0 bg-transparent py-2 shadow-none"
                              value={r.nextAction}
                              onChange={(e) => {
                                const copy = [...apps];
                                copy[i].nextAction = e.target.value;
                                saveApps(copy);
                              }}
                              aria-label={`Application ${i + 1} next action`}
                            />
                          </td>
                          <td className="p-2 align-top">
                            <input
                              type="date"
                              className="input min-h-10 border-0 bg-transparent py-2 shadow-none"
                              value={r.due || ""}
                              onChange={(e) => {
                                const copy = [...apps];
                                copy[i].due = e.target.value;
                                saveApps(copy);
                              }}
                              aria-label={`Application ${i + 1} due date`}
                            />
                          </td>
                          <td className="p-2 align-top">
                            <button
                              type="button"
                              className="btn surface-muted min-h-9 px-2 text-sm text-red-600 dark:text-red-400"
                              onClick={() => saveApps(apps.filter((_, j) => j !== i))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function InlineBarChart<T extends Record<string, unknown>>({ data, xKey, yKey }: { data: T[]; xKey: keyof T; yKey: keyof T }) {
  const width = 600;
  const height = 240;
  const pad = 32;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const maxY = Math.max(1, ...data.map((d) => Number(d[yKey]) || 0));
  const barW = data.length ? (innerW / data.length) * 0.6 : 0;
  const grid = "rgb(var(--tw-ink-faint) / 0.25)";
  const label = "rgb(var(--tw-ink-muted))";
  const bar = "rgb(var(--tw-accent))";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full text-ink-muted" aria-hidden>
      <rect x={pad} y={pad} width={innerW} height={innerH} fill="none" stroke={grid} />
      {data.map((d, i) => {
        const x = pad + (innerW / Math.max(1, data.length)) * i + (innerW / Math.max(1, data.length) - barW) / 2;
        const val = Number(d[yKey]) || 0;
        const h = (val / maxY) * innerH;
        const y = pad + innerH - h;
        return <rect key={i} x={x} y={y} width={barW} height={h} fill={bar} opacity={0.85} />;
      })}
      {data.map((d, i) => {
        const x = pad + (innerW / Math.max(1, data.length)) * i + innerW / Math.max(1, data.length) / 2;
        return (
          <text key={`t${i}`} x={x} y={height - 8} textAnchor="middle" fontSize="10" fill={label}>
            {String(d[xKey]).slice(0, 8)}
          </text>
        );
      })}
      {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => (
        <g key={idx}>
          <line
            x1={pad}
            x2={width - pad}
            y1={pad + innerH - innerH * f}
            y2={pad + innerH - innerH * f}
            stroke={grid}
          />
          <text x={8} y={pad + innerH - innerH * f} fontSize="10" fill={label} dominantBaseline="middle">
            {Math.round(maxY * f)}
          </text>
        </g>
      ))}
    </svg>
  );
}
