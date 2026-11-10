import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, ChevronRight, ClipboardPaste, Copy, Download, FileText, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Printer, RotateCcw, Trash2, Upload } from "lucide-react";
import { getLocal, setLocal } from "../../hooks/useLocal";
import ResumeDocument from "./document/ResumeDocument";
import { exportPlainText } from "./document/exportText";
import ResumeEditor, { EDITOR_SECTIONS, type EditorSection } from "./editor/ResumeEditor";
import DocumentSettingsPanel, { TemplatePicker } from "./editor/DocumentSettingsPanel";
import { PAPER, newVersion } from "./model/defaults";
import { RESUME_DOCS_KEY, loadVersions } from "./model/storage";
import type { ImportSource, ParseIssue, ResumeVersion } from "./model/types";
import { parseResumeText } from "./parse/parseResume";
import ParseReview from "./review/ParseReview";
import JobRequirementsPanel from "./job/JobRequirementsPanel";
import MatchPanel from "./job/MatchPanel";
import { documentChecks } from "./review/checks";
import "./resume-studio.css";

type MobileTab = "edit" | "preview" | "requirements" | "review";
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5];
const LAYOUT_KEY = "pd:careeros:resume-layout";

function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const issueToEditor = (issue: ParseIssue): EditorSection | null => {
  if (issue.section === "extraction") return null;
  if (issue.section.startsWith("custom:")) return "custom";
  return issue.section as EditorSection;
};

export default function ResumeStudioPage() {
  const [versions, setVersions] = useState<ResumeVersion[]>(loadVersions);
  const [activeId, setActiveId] = useState<string | null>(() => getLocal<string | null>("pd:careeros:resume-active", null));
  const [leftView, setLeftView] = useState<"content" | "design" | "import">("content");
  const [section, setSection] = useState<EditorSection>("contact");
  const [mobileTab, setMobileTab] = useState<MobileTab>("edit");
  const [rightView, setRightView] = useState<"job" | "review">("job");
  const [jobView, setJobView] = useState<"requirements" | "match">("requirements");
  const [layout, setLayout] = useState(() => getLocal(LAYOUT_KEY, { left: true, right: true }));
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitZoom, setFitZoom] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  const active = versions.find((version) => version.id === activeId) || versions[0];

  useEffect(() => setLocal(RESUME_DOCS_KEY, versions), [versions]);
  useEffect(() => setLocal("pd:careeros:resume-active", active?.id ?? null), [active?.id]);
  useEffect(() => setLocal(LAYOUT_KEY, layout), [layout]);

  const updateActive = useCallback(
    (change: Partial<ResumeVersion>) => {
      if (!active) return;
      setVersions((current) => current.map((version) => (version.id === active.id ? { ...version, ...change, updatedAt: new Date().toISOString() } : version)));
    },
    [active],
  );

  const addVersion = (version: ResumeVersion, message: string) => {
    setVersions((current) => [version, ...current]);
    setActiveId(version.id);
    setStatus(message);
  };

  const importText = (text: string, source: Omit<ImportSource, "extractedText" | "importedAt">, warnings: string[] = []) => {
    const parsed = parseResumeText(text);
    const issues: ParseIssue[] = [...warnings.map((message) => ({ id: crypto.randomUUID(), severity: "warning" as const, section: "extraction" as const, message })), ...parsed.issues];
    const name = source.fileName ? source.fileName.replace(/\.[^.]+$/, "") : `Pasted résumé ${versions.length + 1}`;
    addVersion(
      newVersion(name, parsed.resume, { source: { ...source, extractedText: text, importedAt: new Date().toISOString() }, issues }),
      `Imported ${name}. ${issues.length ? `${issues.length} item${issues.length === 1 ? "" : "s"} need review.` : "No parsing issues found."}`,
    );
    setLeftView("content");
    setSection("contact");
    if (issues.length) setLayout((current) => ({ ...current, right: true }));
    // Show how the import was understood first; the job match view is one click away.
    setRightView("review");
  };

  const onUpload = async (file?: File) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const { extractResumeFile } = await import("./parse/extract");
      const extracted = await extractResumeFile(file);
      if (!extracted.text.trim()) throw new Error(extracted.warnings[0] || "No text could be extracted from this file.");
      importText(extracted.text, { fileName: file.name, kind: extracted.kind, sizeBytes: file.size }, extracted.warnings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this file.");
    } finally {
      setBusy(false);
    }
  };

  // Fit-to-width zoom follows the preview panel size.
  const paperWidthPx = PAPER[active?.settings.paper ?? "letter"].widthIn * 96;
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setFitZoom(Math.max(0.2, Math.min(1.25, (width - 32) / paperWidthPx)));
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [paperWidthPx, active?.id]);
  const effectiveZoom = zoom === "fit" ? fitZoom : zoom;

  // Print only the document pages (also when the user presses Ctrl/Cmd+P).
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const goToPage = (page: number) => {
    const target = scrollerRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage(page);
  };
  const onScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const pages = Array.from(scroller.querySelectorAll<HTMLElement>("[data-page]"));
    const top = scroller.getBoundingClientRect().top;
    let page = 1;
    for (const element of pages) if (element.getBoundingClientRect().top - top < scroller.clientHeight / 2) page = Number(element.dataset.page);
    setCurrentPage(page);
  };

  const checks = useMemo(() => (active ? documentChecks(active.resume, active.settings, pageCount) : []), [active, pageCount]);
  const openIssues = active ? active.issues.filter((issue) => !active.resolvedIssues.includes(issue.id)) : [];

  const copyText = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(exportPlainText(active.resume, active.settings));
      setStatus("Plain-text résumé copied to the clipboard.");
    } catch {
      setError("Clipboard access was blocked. Use Download .txt instead.");
    }
  };

  const exportFile = async (format: "pdf" | "docx") => {
    if (!active) return;
    setExporting(true);
    setError("");
    try {
      const base = (active.name || "resume").replace(/[\\/:*?"<>|]+/g, "-");
      if (format === "pdf") {
        const { exportPdf } = await import("./document/exportPdf");
        const result = await exportPdf(active.resume, active.settings);
        download(`${base}.pdf`, result.bytes, "application/pdf");
        setStatus(result.warnings[0] ?? "PDF downloaded. Text in it is selectable.");
      } else {
        const { exportDocx } = await import("./document/exportDocx");
        download(`${base}.docx`, exportDocx(active.resume, active.settings) as BlobPart, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        setStatus("DOCX downloaded.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? `Export failed: ${cause.message}` : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const panelClass = (...tabs: MobileTab[]) => `rs-panel ${tabs.includes(mobileTab) ? "rs-mobile-active" : ""}`;
  const selectTab = (tab: MobileTab) => {
    setMobileTab(tab);
    if (tab === "requirements") setRightView("job");
    if (tab === "review") setRightView("review");
  };
  const requirementCount = active?.job?.requirements.filter((item) => item.selected).length ?? 0;

  return (
    <div className="career-feature rs-studio-page">
      <div className="career-feature-header rs-header">
        <div>
          <span className="career-overline">PRESENT YOUR WORK</span>
          <h1>Résumé Studio</h1>
          <p>Import a résumé, review how it was understood, and edit it as a structured, print-ready document.</p>
        </div>
        <div className="career-header-actions">
          <label className={`career-secondary-button career-upload ${busy ? "is-busy" : ""}`}>
            <Upload size={16} /> {busy ? "Reading file…" : "Import PDF, DOCX, TXT"}
            <input type="file" accept=".pdf,.docx,.txt,.md" disabled={busy} onChange={(event) => { void onUpload(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          <button className="career-secondary-button" type="button" onClick={() => { setLeftView("import"); setMobileTab("edit"); setLayout((current) => ({ ...current, left: true })); }}>
            <ClipboardPaste size={16} /> Paste text
          </button>
          <button className="career-quick-create" type="button" onClick={() => addVersion(newVersion(`Résumé ${versions.length + 1}`), "Created a blank résumé.")}>
            <Plus size={16} /> New version
          </button>
        </div>
      </div>
      {error ? <p className="career-form-error" role="alert">{error}</p> : null}
      <p className="rs-status" role="status" aria-live="polite">{status}</p>

      <div className="rs-tabs" role="tablist" aria-label="Résumé Studio panels">
        {(["edit", "preview", "requirements", "review"] as MobileTab[]).map((tab) => (
          <button key={tab} role="tab" type="button" aria-selected={mobileTab === tab} className={mobileTab === tab ? "selected" : ""} onClick={() => selectTab(tab)}>
            {tab === "edit" ? "Edit" : tab === "preview" ? "Preview" : tab === "requirements" ? `Requirements${requirementCount ? ` (${requirementCount})` : ""}` : `Review${openIssues.length ? ` (${openIssues.length})` : ""}`}
          </button>
        ))}
      </div>

      <div className={`rs-studio ${layout.left ? "" : "rs-left-collapsed"} ${layout.right ? "" : "rs-right-collapsed"}`}>
        {/* Left: content */}
        <aside className={`${panelClass("edit")} rs-left`} aria-label="Résumé content">
          {layout.left ? (
            <>
              <div className="rs-panel-head">
                <h2>Content</h2>
                <button type="button" className="rs-icon-button rs-collapse" aria-label="Collapse content panel" onClick={() => setLayout({ ...layout, left: false })}>
                  <PanelLeftClose size={16} />
                </button>
              </div>
              {versions.length ? (
                <div className="rs-version">
                  <div className="rs-field">
                    <label htmlFor="rs-version-select">Version</label>
                    <select id="rs-version-select" value={active?.id} onChange={(event) => setActiveId(event.target.value)}>
                      {versions.map((version) => (
                        <option key={version.id} value={version.id}>{version.name}</option>
                      ))}
                    </select>
                  </div>
                  {active ? (
                    <>
                      <div className="rs-field">
                        <label htmlFor="rs-version-name">Version name</label>
                        <input id="rs-version-name" value={active.name} onChange={(event) => updateActive({ name: event.target.value })} />
                      </div>
                      <div className="rs-version-actions">
                        <button type="button" className="career-secondary-button" onClick={() => addVersion({ ...structuredClone(active), id: crypto.randomUUID(), name: `${active.name} (copy)`, createdAt: new Date().toISOString() }, `Duplicated ${active.name}.`)}>
                          <Copy size={14} /> Duplicate
                        </button>
                        <button
                          type="button"
                          className="career-danger-button"
                          onClick={() => {
                            if (!window.confirm(`Delete "${active.name}"? This cannot be undone.`)) return;
                            setVersions((current) => current.filter((version) => version.id !== active.id));
                            setActiveId(null);
                            setStatus(`Deleted ${active.name}.`);
                          }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className="rs-segmented" role="tablist" aria-label="Content panel view">
                {(["content", "design", "import"] as const).map((view) => (
                  <button key={view} type="button" role="tab" aria-selected={leftView === view} className={leftView === view ? "selected" : ""} onClick={() => setLeftView(view)}>
                    {view === "content" ? "Sections" : view === "design" ? "Design" : "Import"}
                  </button>
                ))}
              </div>

              {leftView === "import" ? (
                <div className="rs-editor-grid">
                  <div className="rs-field">
                    <label htmlFor="rs-paste">Résumé text</label>
                    <textarea id="rs-paste" rows={14} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste your résumé text here. Keep line breaks where possible." />
                  </div>
                  <button type="button" className="career-quick-create" disabled={!pasteText.trim()} onClick={() => { importText(pasteText, { fileName: "", kind: "paste" }); setPasteText(""); }}>
                    Parse into a new version
                  </button>
                  <p className="career-muted">Text is parsed in this browser. Nothing is uploaded.</p>
                </div>
              ) : !active ? (
                <div className="rs-empty">
                  <FileText size={28} aria-hidden="true" />
                  <p>Import a file, paste text, or start a blank version.</p>
                </div>
              ) : leftView === "design" ? (
                <DocumentSettingsPanel settings={active.settings} resume={active.resume} onChange={(settings) => updateActive({ settings })} />
              ) : (
                <>
                  <nav className="rs-section-nav" aria-label="Résumé sections">
                    {EDITOR_SECTIONS.map((item) => (
                      <button key={item.key} type="button" aria-current={section === item.key ? "true" : undefined} className={section === item.key ? "selected" : ""} onClick={() => setSection(item.key)}>
                        {item.label}
                        {active.issues.some((issue) => !active.resolvedIssues.includes(issue.id) && issueToEditor(issue) === item.key) ? <><span className="rs-dot" aria-hidden="true" /><span className="rs-sr"> (needs review)</span></> : null}
                      </button>
                    ))}
                  </nav>
                  <h3 className="rs-section-title">{EDITOR_SECTIONS.find((item) => item.key === section)?.label}</h3>
                  <ResumeEditor resume={active.resume} section={section} onChange={(resume) => updateActive({ resume })} />
                </>
              )}
            </>
          ) : (
            <button type="button" className="rs-icon-button rs-rail" aria-label="Expand content panel" onClick={() => setLayout({ ...layout, left: true })}>
              <PanelLeftOpen size={16} />
            </button>
          )}
        </aside>

        {/* Center: document preview */}
        <section className={`${panelClass("preview")} rs-center`} aria-label="Document preview">
          <div className="rs-toolbar">
            <div className="rs-toolbar-group">
              <label className="rs-sr" htmlFor="rs-zoom">Zoom</label>
              <select id="rs-zoom" value={String(zoom)} onChange={(event) => setZoom(event.target.value === "fit" ? "fit" : Number(event.target.value))}>
                <option value="fit">Fit width</option>
                {ZOOMS.map((value) => (
                  <option key={value} value={value}>{Math.round(value * 100)}%</option>
                ))}
              </select>
              <div className="rs-pager">
                <button type="button" className="rs-icon-button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
                  <ChevronLeft size={16} />
                </button>
                <span aria-live="polite">Page {Math.min(currentPage, pageCount)} of {pageCount}</span>
                <button type="button" className="rs-icon-button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => goToPage(currentPage + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="rs-toolbar-group">
              <button type="button" className="career-secondary-button" disabled={!active} onClick={copyText}>
                <Copy size={15} /> Copy text
              </button>
              <button type="button" className="career-secondary-button" disabled={!active} onClick={() => active && download(`${active.name || "resume"}.txt`, exportPlainText(active.resume, active.settings), "text/plain;charset=utf-8")}>
                <Download size={15} /> .txt
              </button>
              <button type="button" className="career-secondary-button" disabled={!active || exporting} onClick={() => void exportFile("pdf")}>
                <Download size={15} /> PDF
              </button>
              <button type="button" className="career-secondary-button" disabled={!active || exporting} onClick={() => void exportFile("docx")}>
                <Download size={15} /> DOCX
              </button>
              <button type="button" className="career-quick-create" disabled={!active} onClick={() => { flushSync(() => setPrinting(true)); window.print(); setPrinting(false); }}>
                <Printer size={15} /> Print / Save as PDF
              </button>
            </div>
          </div>
          {active ? (
            <>
              <div className="rs-template-strip">
                <TemplatePicker settings={active.settings} onChange={(settings) => updateActive({ settings })} />
              </div>
              {active.settings.pagePreference === "one" && pageCount > 1 ? (
                <p className="rs-notice" role="note">
                  This résumé runs to {pageCount} pages. Text is kept at {active.settings.fontSize} pt rather than shrunk; consider trimming older or less relevant content.
                </p>
              ) : null}
              <div className="rs-canvas" ref={scrollerRef} onScroll={onScroll} tabIndex={0} aria-label="Document pages, scrollable">
                <ResumeDocument resume={active.resume} settings={active.settings} zoom={effectiveZoom} printing={printing} onPagesChange={setPageCount} />
              </div>
            </>
          ) : (
            <div className="rs-canvas rs-canvas-empty" ref={scrollerRef}>
              <p>Your formatted résumé will appear here.</p>
            </div>
          )}
        </section>

        {/* Right: review */}
        <aside className={`${panelClass("requirements", "review")} rs-right`} aria-label="Job match and review">
          {layout.right ? (
            <>
              <div className="rs-panel-head">
                <h2>{rightView === "job" ? "Job match" : "Review"}</h2>
                <button type="button" className="rs-icon-button rs-collapse" aria-label="Collapse review panel" onClick={() => setLayout({ ...layout, right: false })}>
                  <PanelRightClose size={16} />
                </button>
              </div>
              <div className="rs-segmented rs-right-switch" role="tablist" aria-label="Right panel view">
                <button type="button" role="tab" aria-selected={rightView === "job"} className={rightView === "job" ? "selected" : ""} onClick={() => setRightView("job")}>
                  Job match{requirementCount ? ` (${requirementCount})` : ""}
                </button>
                <button type="button" role="tab" aria-selected={rightView === "review"} className={rightView === "review" ? "selected" : ""} onClick={() => setRightView("review")}>
                  Document review{openIssues.length ? ` (${openIssues.length})` : ""}
                </button>
              </div>
              {active && rightView === "job" ? (
                <>
                <div className="rs-segmented rs-two-way" role="tablist" aria-label="Job match view">
                  <button type="button" role="tab" aria-selected={jobView === "requirements"} className={jobView === "requirements" ? "selected" : ""} onClick={() => setJobView("requirements")}>
                    Requirements
                  </button>
                  <button type="button" role="tab" aria-selected={jobView === "match"} className={jobView === "match" ? "selected" : ""} onClick={() => setJobView("match")}>
                    Match &amp; suggestions
                  </button>
                </div>
                {jobView === "match" ? (
                  <MatchPanel
                    resume={active.resume}
                    settings={active.settings}
                    job={active.job ?? { title: "", description: "", requirements: [] }}
                    pageCount={pageCount}
                    onJobChange={(job) => updateActive({ job })}
                    onApply={(change, message) => {
                      updateActive({ ...(change.resume ? { resume: change.resume } : {}), ...(change.settings ? { settings: change.settings } : {}) });
                      setStatus(message);
                    }}
                  />
                ) : (
                <JobRequirementsPanel
                  job={active.job}
                  title={active.job?.title || active.resume.targetRole}
                  onChange={(job) => updateActive({ job })}
                  onTitleChange={(title) => updateActive({ job: { ...(active.job ?? { description: "", requirements: [] }), title }, resume: { ...active.resume, targetRole: title } })}
                  onStatus={setStatus}
                  onShowMatch={() => setJobView("match")}
                />
                )}
                </>
              ) : active ? (
                <>
                  <ParseReview
                    version={active}
                    onResolve={(id) => updateActive({ resolvedIssues: [...active.resolvedIssues, id] })}
                    onReopenAll={() => updateActive({ resolvedIssues: [] })}
                    onGoTo={(issue) => {
                      const target = issueToEditor(issue);
                      if (!target) return;
                      setLeftView("content");
                      setSection(target);
                      setLayout((current) => ({ ...current, left: true }));
                      setMobileTab("edit");
                    }}
                  />
                  {active.source ? (
                    <button
                      type="button"
                      className="career-secondary-button rs-reparse"
                      onClick={() => {
                        if (!active.source || !window.confirm("Re-parse the original extracted text? Your edits to this version will be replaced.")) return;
                        const parsed = parseResumeText(active.source.extractedText);
                        updateActive({ resume: parsed.resume, issues: parsed.issues, resolvedIssues: [] });
                        setStatus("Re-parsed from the original extracted text.");
                      }}
                    >
                      <RotateCcw size={14} /> Re-parse original text
                    </button>
                  ) : null}
                  <section className="rs-checks" aria-labelledby="rs-checks-title">
                    <h3 id="rs-checks-title">Document checks</h3>
                    <p className="career-muted">Structure and readability only. These are not a job-match or ATS score.</p>
                    <ul>
                      {checks.map((check) => (
                        <li key={check.id} className={check.ok ? "ok" : "warn"}>
                          <strong>{check.ok ? "✓" : "!"} {check.label}</strong>
                          <span>{check.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              ) : (
                <p className="career-muted">Import or create a résumé to see parsing review and document checks.</p>
              )}
            </>
          ) : (
            <button type="button" className="rs-icon-button rs-rail" aria-label="Expand review panel" onClick={() => setLayout({ ...layout, right: true })}>
              <PanelRightOpen size={16} />
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
