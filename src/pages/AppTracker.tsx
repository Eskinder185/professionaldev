import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";

type AppItem = { id: string; company: string; role: string; status: string; date: string; notes?: string };

function toCSV(items: AppItem[]) {
  const header = ["Company", "Role", "Status", "Date", "Notes"].join(",");
  const rows = items.map((i) =>
    [i.company, i.role, i.status, i.date, (i.notes || "").replace(/\n/g, " ")]
      .map((v) => '"' + (v || "").replace(/"/g, '""') + '"')
      .join(",")
  );
  return [header, ...rows].join("\n");
}
function fromCSV(text: string): Omit<AppItem, "id">[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const rows = lines
    .slice(1)
    .map((l) =>
      l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'))
    );
  return rows.map((r) => ({
    company: r[0] || "",
    role: r[1] || "",
    status: r[2] || "Applied",
    date: r[3] || new Date().toISOString().slice(0, 10),
    notes: r[4] || "",
  }));
}

export default function AppTracker() {
  const [items, setItems] = useState<AppItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("appTracker:items") || "[]");
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState<Omit<AppItem, "id">>({
    company: "",
    role: "",
    status: "Applied",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  useEffect(() => {
    try {
      localStorage.setItem("appTracker:items", JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = () => {
    setItems([{ id: crypto.randomUUID(), ...draft }, ...items]);
    setDraft({ company: "", role: "", status: draft.status, date: new Date().toISOString().slice(0, 10), notes: "" });
  };
  const remove = (id: string) => setItems(items.filter((i) => i.id !== id));
  const update = (id: string, patch: Partial<AppItem>) =>
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const exportCsv = () => {
    const blob = new Blob([toCSV(items)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "applications.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importCsv = async (file: File) => {
    const text = await file.text();
    const rows = fromCSV(text);
    setItems([...rows.map((r) => ({ id: crypto.randomUUID(), ...r })), ...items]);
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of items) map[i.status] = (map[i.status] || 0) + 1;
    return map;
  }, [items]);

  return (
    <div className="mx-auto max-w-6xl space-y-0">
      <PageHeader
        eyebrow="Resources"
        title="Application Tracker"
        sub="Track applications, statuses, and notes. Import/export CSV. Data stays in your browser."
      />

      <section className="border-t border-border/70 pt-8 sm:pt-10">
        <div className="grid gap-2 md:grid-cols-5 md:items-end">
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm text-ink-muted">Company</label>
            <input
              className="input w-full"
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm text-ink-muted">Role</label>
            <input className="input w-full" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm text-ink-muted">Status</label>
            <select
              className="input w-full"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              {["Applied", "Phone Screen", "Interview", "Offer", "Rejected"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm text-ink-muted">Date</label>
            <input
              type="date"
              className="input w-full"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </div>
          <div className="md:col-span-1">
            <button type="button" className="btn btn-primary min-h-11 w-full" onClick={add}>
              Add
            </button>
          </div>
          <div className="md:col-span-5">
            <label className="mb-1 block text-sm text-ink-muted">Notes</label>
            <textarea
              className="textarea min-h-20 w-full"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="btn surface-muted min-h-10 px-4" onClick={exportCsv}>
            Export CSV
          </button>
          <label className="btn surface-muted min-h-10 cursor-pointer px-4">
            Import CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
              }}
            />
          </label>
        </div>
      </section>

      <section className="border-t border-border/70 pt-8 sm:pt-10">
        <h2 className="font-medium text-ink dark:text-white">Summary</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {Object.entries(counts).map(([k, v]) => (
            <span key={k} className="text-ink-muted">
              {k}: <span className="font-medium text-ink dark:text-white">{v}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="border-t border-border/70 pt-8 sm:pt-10 pb-4">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left">
                <th className="py-2 pr-4">Company</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Notes</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-border/50">
                  <td className="py-2 pr-4">
                    <input className="input min-h-8 w-full py-1 text-sm" value={i.company} onChange={(e) => update(i.id, { company: e.target.value })} />
                  </td>
                  <td className="py-2 pr-4">
                    <input className="input min-h-8 w-full py-1 text-sm" value={i.role} onChange={(e) => update(i.id, { role: e.target.value })} />
                  </td>
                  <td className="py-2 pr-4">
                    <select className="input min-h-8 w-full py-1 text-sm" value={i.status} onChange={(e) => update(i.id, { status: e.target.value })}>
                      {["Applied", "Phone Screen", "Interview", "Offer", "Rejected"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <input type="date" className="input min-h-8 w-full py-1 text-sm" value={i.date} onChange={(e) => update(i.id, { date: e.target.value })} />
                  </td>
                  <td className="py-2 pr-4">
                    <input className="input min-h-8 w-full py-1 text-sm" value={i.notes || ""} onChange={(e) => update(i.id, { notes: e.target.value })} />
                  </td>
                  <td className="py-2">
                    <button type="button" className="text-sm text-red-600 underline dark:text-red-400" onClick={() => remove(i.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
