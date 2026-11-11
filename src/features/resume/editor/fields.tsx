import { useEffect, useId, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

export function Field({ label, value, onChange, placeholder, type = "text", hint }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; hint?: string }) {
  const id = useId();
  return (
    <div className="rs-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
    </div>
  );
}

export function AreaField({ label, value, onChange, rows = 3, placeholder }: { label: string; value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  const id = useId();
  return (
    <div className="rs-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

/** Comma-separated list editor that commits (and de-duplicates) on blur. */
export function ListField({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (values: string[]) => void; placeholder?: string }) {
  const id = useId();
  const [draft, setDraft] = useState(values.join(", "));
  useEffect(() => setDraft(values.join(", ")), [values]);
  const commit = () => {
    const seen = new Set<string>();
    const next = draft
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter((item) => item && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()));
    onChange(next);
    setDraft(next.join(", "));
  };
  return (
    <div className="rs-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={2} value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} onBlur={commit} aria-describedby={`${id}-hint`} />
      <small id={`${id}-hint`}>Separate items with commas. Duplicates are removed.</small>
    </div>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="rs-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export const move = <T,>(items: T[], index: number, delta: number) => {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export function RowActions({ label, index, count, onMove, onRemove }: { label: string; index: number; count: number; onMove: (delta: number) => void; onRemove?: () => void }) {
  return (
    <div className="rs-row-actions">
      <button type="button" className="rs-icon-button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(-1)}>
        <ArrowUp size={14} />
      </button>
      <button type="button" className="rs-icon-button" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
        <ArrowDown size={14} />
      </button>
      {onRemove ? (
        <button type="button" className="rs-icon-button rs-danger" aria-label={`Remove ${label}`} onClick={onRemove}>
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  );
}

/** Editable list of bullet strings: real list items, never one paragraph. */
export function BulletEditor({ label, items, onChange, addLabel = "Add bullet" }: { label: string; items: string[]; onChange: (items: string[]) => void; addLabel?: string }) {
  return (
    <fieldset className="rs-bullets">
      <legend>{label}</legend>
      {items.map((item, index) => (
        <div className="rs-bullet-row" key={index}>
          <span aria-hidden="true" className="rs-bullet-dot">•</span>
          <textarea
            rows={2}
            value={item}
            aria-label={`${label} ${index + 1}`}
            onChange={(event) => onChange(items.map((current, position) => (position === index ? event.target.value : current)))}
          />
          <RowActions label={`${label.toLowerCase()} ${index + 1}`} index={index} count={items.length} onMove={(delta) => onChange(move(items, index, delta))} onRemove={() => onChange(items.filter((_, position) => position !== index))} />
        </div>
      ))}
      <button type="button" className="rs-add" onClick={() => onChange([...items, ""])}>
        <Plus size={14} /> {addLabel}
      </button>
    </fieldset>
  );
}

export function EntryCard({ title, children, defaultOpen }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="rs-entry" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="rs-entry-body">{children}</div>
    </details>
  );
}
