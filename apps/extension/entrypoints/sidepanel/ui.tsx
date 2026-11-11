import { useId, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="CareerOS logo">
      <defs>
        <linearGradient id="cos-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#cos-g)" />
      <path d="M21.5 11.2a7 7 0 1 0 0 9.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M17 16h8m0 0-3-3m3 3-3 3" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Banner({
  tone,
  children,
  onDismiss,
  critical,
  testId,
}: {
  tone: Tone;
  children: ReactNode;
  onDismiss?: () => void;
  critical?: boolean;
  testId?: string;
}) {
  return (
    <div className={`banner banner-${tone}`} role={critical ? "alert" : "status"} data-testid={testId}>
      <div className="banner-body">{children}</div>
      {onDismiss && !critical ? (
        <button type="button" className="icon-btn icon-btn-sm" aria-label="Dismiss notice" onClick={onDismiss}>
          <X size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function Card({
  id,
  title,
  badge,
  collapsible,
  collapsed,
  onToggle,
  children,
  testId,
  actions,
}: {
  id: string;
  title: string;
  badge?: ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  children: ReactNode;
  testId?: string;
  actions?: ReactNode;
}) {
  const bodyId = useId();
  const isCollapsed = collapsible && collapsed;
  return (
    <section className="card" data-testid={testId ?? `card-${id}`} aria-labelledby={`${bodyId}-h`}>
      <header className="card-head">
        {collapsible ? (
          <button type="button" className="card-toggle" aria-expanded={!isCollapsed} aria-controls={bodyId} onClick={onToggle}>
            <h2 id={`${bodyId}-h`} className="card-title">
              {title}
            </h2>
            <ChevronDown size={16} aria-hidden className={`chev ${isCollapsed ? "" : "chev-open"}`} />
          </button>
        ) : (
          <h2 id={`${bodyId}-h`} className="card-title">
            {title}
          </h2>
        )}
        <div className="card-head-extras">
          {badge}
          {actions}
        </div>
      </header>
      <div id={bodyId} className={`card-body ${isCollapsed ? "card-body-collapsed" : ""}`} hidden={isCollapsed}>
        {children}
      </div>
    </section>
  );
}

export function Gauge({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 26;
  const c = 2 * Math.PI * r;
  const tone = clamped >= 70 ? "success" : clamped >= 40 ? "warning" : "danger";
  return (
    <div className="gauge" role="img" aria-label={label}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} className="gauge-track" />
        <circle cx="32" cy="32" r={r} className={`gauge-bar gauge-${tone}`} strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)} transform="rotate(-90 32 32)" />
      </svg>
      <span className="gauge-num">{clamped}</span>
    </div>
  );
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId?: string }) {
  return (
    <div className="modal-backdrop" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
        <header className="modal-head">
          <h2 className="card-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} autoFocus>
            <X size={16} aria-hidden />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function useToggleState(initial = false): [boolean, () => void] {
  const [v, setV] = useState(initial);
  return [v, () => setV((x) => !x)];
}
