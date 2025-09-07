import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Community page with interactive tabs: Stories, Mentors, Q&A, Networking.
 * Users can share short success stories, bookmark mentors, ask/answer questions,
 * and copy networking templates. All data persists in localStorage.
 */

// Helper tab component
function Tabs({
  tabs,
  current,
  onChange,
}: {
  tabs: string[];
  current: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={
            "px-4 py-2 rounded-full text-sm font-medium border transition-colors " +
            (current === t
              ? "bg-blue-600 text-white border-blue-600 shadow"
              : "bg-white text-gray-700 hover:bg-gray-100 border-gray-300")
          }
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ========= Stories ========= */
type Story = { name: string; role: string; takeaway: string };
const STORIES_KEY = "pd_community_stories";

function Stories() {
  const [items, setItems] = useState<Story[]>([]);
  const [draft, setDraft] = useState<Story>({ name: "", role: "", takeaway: "" });

  // Load saved stories on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORIES_KEY);
    if (saved) setItems(JSON.parse(saved));
  }, []);

  function persist(next: Story[]) {
    localStorage.setItem(STORIES_KEY, JSON.stringify(next));
    setItems(next);
  }

  function add() {
    if (!draft.name || !draft.role || !draft.takeaway) return;
    const next = [draft, ...items];
    persist(next);
    setDraft({ name: "", role: "", takeaway: "" });
  }

  function remove(i: number) {
    const next = items.filter((_, idx) => idx !== i);
    persist(next);
  }

  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-4 bg-white shadow-sm">
        <h3 className="font-semibold mb-3">Share a quick win</h3>
        <div className="grid md:grid-cols-3 gap-2">
          <input
            className="border rounded p-2"
            placeholder="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <input
            className="border rounded p-2"
            placeholder="Role (e.g., Cloud Intern)"
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          />
          <input
            className="border rounded p-2 md:col-span-1 col-span-3"
            placeholder="Big takeaway"
            value={draft.takeaway}
            onChange={(e) => setDraft({ ...draft, takeaway: e.target.value })}
          />
        </div>
        <button
          onClick={add}
          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Post
        </button>
      </div>
      <div className="grid gap-3">
        {items.length === 0 && (
          <div className="text-gray-500 italic">No stories yet — be the first!</div>
        )}
        {items.map((s, i) => (
          <div
            key={i}
            className="border rounded-xl p-4 bg-white shadow-sm flex justify-between gap-3"
          >
            <div>
              <div className="font-medium">
                {s.name} • {s.role}
              </div>
              <div className="text-gray-700">{s.takeaway}</div>
            </div>
            <button
              onClick={() => remove(i)}
              className="text-sm border rounded px-2 py-1 text-gray-600 hover:bg-gray-100"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========= Mentors ========= */
type Mentor = { name: string; area: string; link?: string };
const MENTOR_FAVS_KEY = "pd_mentor_favs";
const SAMPLE_MENTORS: Mentor[] = [
  { name: "Asha", area: "Cloud • AWS" },
  { name: "Miguel", area: "Security • Blue Team" },
  { name: "Priya", area: "Frontend • React" },
  { name: "Jalen", area: "Data • ML" },
];

function Mentors() {
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem(MENTOR_FAVS_KEY);
    if (saved) setFavs(JSON.parse(saved));
  }, []);

  function toggle(name: string) {
    const next = favs.includes(name) ? favs.filter((n) => n !== name) : [...favs, name];
    setFavs(next);
    localStorage.setItem(MENTOR_FAVS_KEY, JSON.stringify(next));
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {SAMPLE_MENTORS.map((m) => (
        <div key={m.name} className="border rounded-xl p-4 bg-white shadow-sm space-y-2">
          <div className="font-semibold text-lg">{m.name}</div>
          <div className="text-sm text-gray-600">{m.area}</div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => toggle(m.name)}
              className={
                "px-3 py-1 rounded border text-sm " +
                (favs.includes(m.name)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 hover:bg-gray-100 border-gray-300")
              }
            >
              {favs.includes(m.name) ? "★ Saved" : "☆ Save"}
            </button>
            {m.link && (
              <a
                className="px-3 py-1 rounded border text-sm bg-white text-gray-700 hover:bg-gray-100 border-gray-300"
                href={m.link}
                target="_blank"
                rel="noreferrer"
              >
                Profile
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ========= Q&A ========= */
type QA = { q: string; a?: string };
const QNA_KEY = "pd_qna";

function QAForum() {
  const [items, setItems] = useState<QA[]>([]);
  const [q, setQ] = useState("");
  const [answerDraft, setAnswerDraft] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(QNA_KEY);
    if (saved) setItems(JSON.parse(saved));
  }, []);

  function persist(next: QA[]) {
    localStorage.setItem(QNA_KEY, JSON.stringify(next));
    setItems(next);
  }

  function ask() {
    if (!q.trim()) return;
    persist([{ q: q.trim() }, ...items]);
    setQ("");
  }

  function answer(i: number) {
    if (!answerDraft.trim()) return;
    const next = [...items];
    next[i].a = answerDraft.trim();
    persist(next);
    setAnswerDraft("");
  }

  function remove(i: number) {
    const next = items.filter((_, idx) => idx !== i);
    persist(next);
  }

  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-4 bg-white shadow-sm">
        <h3 className="font-semibold mb-2">Ask a question</h3>
        <div className="flex gap-2">
          <input
            className="border rounded p-2 flex-1"
            placeholder="e.g., How do I prep for SAA?"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            onClick={ask}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Ask
          </button>
        </div>
      </div>
      <div className="grid gap-3">
        {items.length === 0 && (
          <div className="text-gray-500 italic">No questions yet.</div>
        )}
        {items.map((item, i) => (
          <div key={i} className="border rounded-xl p-4 bg-white shadow-sm space-y-2">
            <div className="font-medium">Q: {item.q}</div>
            {item.a ? (
              <div className="text-gray-700">A: {item.a}</div>
            ) : (
              <div className="flex gap-2 mt-1">
                <input
                  className="border rounded p-2 flex-1"
                  placeholder="Add an answer"
                  value={answerDraft}
                  onChange={(e) => setAnswerDraft(e.target.value)}
                />
                <button
                  onClick={() => answer(i)}
                  className="border rounded px-3 py-2 bg-white text-gray-700 hover:bg-gray-100"
                >
                  Post
                </button>
              </div>
            )}
            <button
              onClick={() => remove(i)}
              className="text-xs text-gray-500 underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========= Networking ========= */
function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text);
}

function Networking() {
  const dm = useMemo(
    () =>
      `Hi! I'm exploring ${"cloud/devops"} roles and loved your post. Any advice for someone building projects and certs?`,
    []
  );
  const followUp =
    "Thanks again! Here’s my short portfolio if helpful: <your link>. Happy to return the favor anytime.";

  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-4 bg-white shadow-sm">
        <h3 className="font-semibold mb-2">Quick DM template</h3>
        <div className="text-sm bg-gray-50 p-3 rounded border border-gray-200">
          {dm}
        </div>
        <button
          onClick={() => copyToClipboard(dm)}
          className="mt-2 border rounded px-3 py-2 text-sm bg-white text-gray-700 hover:bg-gray-100"
        >
          Copy
        </button>
      </div>
      <div className="border rounded-xl p-4 bg-white shadow-sm">
        <h3 className="font-semibold mb-2">Follow-up</h3>
        <div className="text-sm bg-gray-50 p-3 rounded border border-gray-200">
          {followUp}
        </div>
        <button
          onClick={() => copyToClipboard(followUp)}
          className="mt-2 border rounded px-3 py-2 text-sm bg-white text-gray-700 hover:bg-gray-100"
        >
          Copy
        </button>
      </div>
      <div className="border rounded-xl p-4 bg-white shadow-sm">
        <h3 className="font-semibold mb-2">Event checklist</h3>
        <ul className="list-disc pl-6 text-sm text-gray-700 space-y-1">
          <li>Make 3 new introductions, send 1 follow-up message</li>
          <li>Ask at least one thoughtful question</li>
          <li>Share your portfolio link</li>
        </ul>
      </div>
    </div>
  );
}

/* ========= Page ========= */
export default function Community() {
  const [tab, setTab] = useState<"Stories" | "Mentors" | "Q&A" | "Networking">("Stories");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 fade-in-up">
      <h1 className="text-3xl font-bold mb-4 gradient-text">Community</h1>
      <p className="text-gray-600 mb-6 max-w-2xl">
        Connect with peers, find mentors, ask questions, and practice networking.
      </p>
      <Tabs
        tabs={["Stories", "Mentors", "Q&A", "Networking"]}
        current={tab}
        onChange={(t) => setTab(t as any)}
      />
      {tab === "Stories" && <Stories />}
      {tab === "Mentors" && <Mentors />}
      {tab === "Q&A" && <QAForum />}
      {tab === "Networking" && <Networking />}
    </div>
  );
}