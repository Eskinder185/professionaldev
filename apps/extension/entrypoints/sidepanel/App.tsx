import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ExternalLink, Flag, Settings } from "lucide-react";
import type { ExtensionPersistentState } from "../../src/storage/stateStore";
import { IconButton, Logo, Badge } from "./ui";
import AutofillTab, { useRunner } from "./AutofillTab";
import ScoreTab from "./ScoreTab";
import ProfileTab from "./ProfileTab";
import PageTab from "./PageTab";
import AssistantTab from "./AssistantTab";
import AISettingsPanel from "./AISettingsPanel";
import { ModelContext, useModel, type Model } from "./lib/context";
import {
  defaultUi,
  loadUi,
  openSettings,
  openUrl,
  readPageContext,
  readState,
  resolveTargetTab,
  saveUi,
  subscribePageEvents,
  subscribeState,
  subscribeTabs,
  urlOnlyContext,
  type PageReadResult,
  type TargetTab,
  type UiPrefs,
} from "./lib/bridge";
import { matchApplication, siteBase } from "./lib/model";
import { aiAvailability } from "./lib/ai";

const TABS: Array<{ id: UiPrefs["tab"]; label: string }> = [
  { id: "page", label: "Page" },
  { id: "ask", label: "Ask" },
  { id: "autofill", label: "Autofill" },
  { id: "score", label: "Résumé Score" },
  { id: "profile", label: "Profile" },
  { id: "ai", label: "AI" },
];

function useAppModel(): Model {
  const [state, setState] = useState<ExtensionPersistentState | null>(null);
  const [tab, setTab] = useState<TargetTab | null>(null);
  const [read, setRead] = useState<PageReadResult | null>(null);
  const [ui, setUi] = useState<UiPrefs>(defaultUi);
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      const st = await readState();
      const t = await resolveTargetTab();
      const app = matchApplication(st, t?.url);
      const r = await readPageContext(t, st.sharedProfile, app);
      setState(st);
      setTab(t);
      setRead(r);
    } finally {
      busy.current = false;
      setLoading(false);
      if (again.current) {
        again.current = false;
        void refresh();
      }
    }
  }, []);

  useEffect(() => {
    void loadUi().then(setUi);
    void refresh();
    const offState = subscribeState(() => void refresh());
    const offTabs = subscribeTabs(() => void refresh());
    // No timer: the panel refreshes when the tab, the saved state, or the page's form changes,
    // and when it becomes visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      offState();
      offTabs();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const watchedTabId = tab?.id;
  useEffect(() => subscribePageEvents(watchedTabId, () => void refresh()), [watchedTabId, refresh]);

  const updateUi = useCallback((patch: Partial<UiPrefs> | ((p: UiPrefs) => Partial<UiPrefs>)) => {
    setUi((prev) => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      void saveUi(next);
      return next;
    });
  }, []);

  return useMemo<Model>(() => {
    const readable = Boolean(read?.ok);
    const page = read ? (read.ok ? read.context : read.fallback) : tab ? urlOnlyContext(tab.url) : null;
    const app = matchApplication(state, page?.url || tab?.url);
    return { state, tab, read, page, readable, app, ui, updateUi, refresh, loading, base: siteBase(state) };
  }, [state, tab, read, ui, updateUi, refresh, loading]);
}

export default function App() {
  const model = useAppModel();
  return (
    <ModelContext.Provider value={model}>
      <Shell />
    </ModelContext.Provider>
  );
}

function AiPill() {
  const m = useModel();
  const ai = aiAvailability(m.state?.aiConnection ?? null);
  if (ai.kind === "ready") {
    const where = `${ai.snapshot.providerLabel} · ${ai.snapshot.model} (on this computer)`;
    return (
      <span className="ai-pill ai-pill-ready" data-testid="header-ai" title={where} tabIndex={0} aria-label={`AI ready. ${where}`}>
        <span className="ai-dot" aria-hidden /> AI Ready
      </span>
    );
  }
  const text = ai.kind === "needs-careeros" ? "AI not on this device" : m.state?.aiConnection ? "AI needs attention" : "Connect AI";
  return (
    <button type="button" className="ai-pill" data-testid="header-ai" onClick={() => m.updateUi({ tab: "ai" })} title={ai.reason}>
      {text}
    </button>
  );
}

function Shell() {
  const m = useModel();
  const runner = useRunner();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const active = m.ui.tab;

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next: number;
    if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    m.updateUi({ tab: TABS[next].id });
    tabRefs.current[TABS[next].id]?.focus();
  };

  const state = m.state;
  const connected = Boolean(state?.connectedOrigin || state?.sharedProfile);

  return (
    <div className="shell">
      <header className="header">
        <div className="brand">
          <Logo />
          <h1 className="brand-name">CareerOS</h1>
        </div>
        <div className="header-actions">
          <IconButton label="Report an issue" onClick={() => openUrl("https://github.com/eskinder185/professionaldev/issues/new?labels=autoapply-extension&title=AutoApply%20extension%20issue")}>
            <Flag size={17} aria-hidden />
          </IconButton>
          <IconButton label="Settings" onClick={openSettings}>
            <Settings size={17} aria-hidden />
          </IconButton>
          <IconButton label="Open CareerOS" onClick={() => openUrl(`${m.base}/autoapply`)}>
            <ExternalLink size={17} aria-hidden />
          </IconButton>
        </div>
      </header>

      <div className="status-row" aria-label="Connection status">
        <Badge tone={connected ? "success" : "warning"}>{connected ? "Synced with CareerOS" : "Not synced"}</Badge>
        <AiPill />
      </div>

      <nav className="tabs" role="tablist" aria-label="AutoApply sections">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            className={`tab ${active === t.id ? "tab-on" : ""}`}
            data-testid={`tab-${t.id}`}
            onClick={() => m.updateUi({ tab: t.id })}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content" id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} tabIndex={-1}>
        {m.loading && !m.page ? (
          <p className="muted" role="status" data-testid="loading">Loading CareerOS…</p>
        ) : active === "page" ? (
          <PageTab />
        ) : active === "ask" ? (
          <AssistantTab />
        ) : active === "autofill" ? (
          <AutofillTab runner={runner} />
        ) : active === "score" ? (
          <ScoreTab />
        ) : active === "profile" ? (
          <ProfileTab />
        ) : (
          <AISettingsPanel />
        )}
      </main>
    </div>
  );
}

