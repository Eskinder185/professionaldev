import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, BriefcaseBusiness, ChevronLeft, ChevronRight, CircleHelp, Compass, FileText, FolderKanban, GraduationCap, LayoutDashboard, Menu, Plus, Search, Settings, Sparkles, Target, UserRound, X } from "lucide-react";
import ThemeToggle from "../ThemeToggle";
import { getLocal, setLocal } from "../../hooks/useLocal";

const groups = [
  { title: "Workspace", items: [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { label: "Discover Jobs", to: "/jobs", icon: Search },
    { label: "My Applications", to: "/applications", icon: BriefcaseBusiness },
  ] },
  { title: "Career Development", items: [
    { label: "Career Roadmap", to: "/resources/roadmaps", icon: Target },
    { label: "Learning Academy", to: "/academy", icon: GraduationCap },
    { label: "Résumé Studio", to: "/resume", icon: FileText },
    { label: "Interview Studio", to: "/interviews", icon: Sparkles },
  ] },
  { title: "My Career", items: [
    { label: "Skills Profile", to: "/resources/trackers", icon: BookOpen },
    { label: "Portfolio", to: "/career-tools/portfolio", icon: FolderKanban },
    { label: "Career Analytics", to: "/analytics", icon: BarChart3 },
  ] },
  { title: "Assistance", items: [
    { label: "Career Coach", to: "/coach", icon: Compass },
    { label: "Resources", to: "/resources", icon: BookOpen },
  ] },
  { title: "Account", items: [
    { label: "Settings", to: "/settings", icon: Settings },
    { label: "Help", to: "/contact", icon: CircleHelp },
  ] },
] as const;

const searchable: { label: string; to: string; icon: typeof Search }[] = groups.flatMap((group) => [...group.items]);

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => getLocal("pd:careeros:sidebar-collapsed", false));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [popover, setPopover] = useState<"profile" | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setLocal("pd:careeros:sidebar-collapsed", collapsed), [collapsed]);
  useEffect(() => { setMobileOpen(false); setSearchOpen(false); setPopover(null); }, [location.pathname]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (event.key === "Escape") { if (searchOpen) searchTriggerRef.current?.focus(); if (mobileOpen) menuTriggerRef.current?.focus(); setSearchOpen(false); setMobileOpen(false); setPopover(null); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, mobileOpen]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    if (mobileOpen) mobileCloseRef.current?.focus();
    if (!mobileOpen && !searchOpen) return;
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const panel = document.querySelector<HTMLElement>(searchOpen ? ".career-search-dialog" : ".career-mobile-drawer");
      const focusable = Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || []).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onTab);
    return () => window.removeEventListener("keydown", onTab);
  }, [mobileOpen, searchOpen]);

  const current = searchable.find((item) => item.to === location.pathname);
  const results = searchable.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  const nav = <>
    <Link to="/dashboard" className="career-brand" aria-label="ProfessionalDev CareerOS dashboard"><span className="career-brand-mark"><Compass size={19} /></span><span className="career-brand-copy"><strong>ProfessionalDev</strong><small>CareerOS</small></span></Link>
    <nav aria-label="Workspace navigation" className="career-nav">
      {groups.map((group) => <div className="career-nav-group" key={group.title}>
        <div className="career-nav-heading">{group.title}</div>
        {group.items.map(({ label, to, icon: Icon }) => <NavLink key={label} to={to} end={to === "/dashboard"} title={collapsed ? label : undefined} aria-label={label} className={({ isActive }) => `career-nav-link ${isActive ? "is-active" : ""}`} onClick={() => setMobileOpen(false)}><Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></NavLink>)}
      </div>)}
    </nav>
    <div className="career-sidebar-bottom"><span className="career-guest"><UserRound size={18} /><span>Guest workspace<small>Stored in this browser</small></span></span><button type="button" className="career-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button></div>
  </>;

  return <div className={`career-shell ${collapsed ? "is-collapsed" : ""}`}>
    <aside className="career-sidebar" aria-label="Sidebar">{nav}</aside>
    <div className="career-workspace">
      <header className="career-topbar">
        <div className="career-topbar-start"><button ref={menuTriggerRef} className="career-icon-button career-menu-button" type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="career-breadcrumb"><span>Workspace</span><ChevronRight size={14} aria-hidden="true" /><strong>{current?.label || "Career tools"}</strong></div></div>
        <div className="career-topbar-actions"><button type="button" ref={searchTriggerRef} className="career-search-trigger" onClick={() => setSearchOpen(true)}><Search size={17} /><span>Search workspace</span><kbd>⌘ K</kbd></button><Link to="/applications?new=1" aria-label="New application" className="career-quick-create"><Plus size={17} /> <span>New application</span></Link><ThemeToggle compact /><div className="career-popover-wrap"><button className="career-avatar" type="button" aria-label="Guest profile" aria-expanded={popover === "profile"} onClick={() => setPopover(popover === "profile" ? null : "profile")}><UserRound size={18} /></button>{popover === "profile" && <div className="career-popover"><strong>Guest workspace</strong><p>Your data is stored in this browser.</p><Link to="/settings">Settings</Link></div>}</div></div>
      </header>
      {children}
    </div>
    <nav className="career-bottom-nav" aria-label="Mobile navigation">{[
      { label: "Home", to: "/dashboard", icon: LayoutDashboard }, { label: "Jobs", to: "/jobs", icon: Search }, { label: "Learn", to: "/academy", icon: GraduationCap }, { label: "Applications", to: "/applications", icon: BriefcaseBusiness },
    ].map(({ label, to, icon: Icon }) => <NavLink key={label} to={to} className={({ isActive }) => `career-bottom-link ${isActive ? "is-active" : ""}`}><Icon size={20} /><span>{label}</span></NavLink>)}<button type="button" className="career-bottom-link" onClick={() => setMobileOpen(true)} aria-label="More navigation"><Menu size={20} /><span>More</span></button></nav>
    {mobileOpen && <div className="career-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileOpen(false); }}><aside className="career-mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobile workspace navigation"><button ref={mobileCloseRef} className="career-icon-button career-drawer-close" type="button" aria-label="Close navigation" onClick={() => { setMobileOpen(false); menuTriggerRef.current?.focus(); }}><X size={20} /></button>{nav}</aside></div>}
    {searchOpen && <div className="career-overlay career-search-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><div className="career-search-dialog" role="dialog" aria-modal="true" aria-label="Search workspace"><div className="career-search-field"><Search size={20} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools and pages" aria-label="Search tools and pages" /><button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={18} /></button></div><div className="career-search-results">{results.length ? results.map((item) => <button key={item.label} type="button" onClick={() => { navigate(item.to); setSearchOpen(false); setQuery(""); }}>{item.label}<ChevronRight size={16} /></button>) : <p>No matching pages</p>}</div><p className="career-search-help">Searches workspace pages. Press Esc to close.</p></div></div>}
  </div>;
}
