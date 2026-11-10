import { useId } from "react";
import { FONT_STACKS, PAPER, TEMPLATE_ORDER, effectiveOrder } from "../model/defaults";
import type { DocumentSettings, Resume, TemplateId } from "../model/types";
import { sectionTitle } from "../document/blocks";
import { RowActions, move } from "./fields";

export const TEMPLATES: Record<TemplateId, { label: string; description: string }> = {
  classic: { label: "Classic ATS", description: "Single column, black on white, conventional headings. Recommended default." },
  modern: { label: "Modern Professional", description: "Refined type with a restrained accent color. Still one column." },
  technical: { label: "Technical Engineer", description: "Leads with skills and projects for engineering roles." },
};

function Select<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  const id = useId();
  return (
    <div className="rs-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={String(value)} onChange={(event) => onChange(options.find((option) => String(option.value) === event.target.value)!.value)}>
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TemplatePicker({ settings, onChange }: { settings: DocumentSettings; onChange: (settings: DocumentSettings) => void }) {
  return (
    <div className="rs-templates" role="radiogroup" aria-label="Résumé template">
      {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={settings.template === id}
          className={settings.template === id ? "selected" : ""}
          onClick={() =>
            onChange({
              ...settings,
              template: id,
              font: id === "modern" ? "calibri" : id === "technical" ? "arial" : "times",
              headerLayout: id === "modern" ? "left" : "center",
              sectionOrder: [...TEMPLATE_ORDER[id], ...settings.sectionOrder.filter((key) => key.startsWith("custom:"))],
            })
          }
        >
          <strong>{TEMPLATES[id].label}</strong>
          <span>{TEMPLATES[id].description}</span>
        </button>
      ))}
    </div>
  );
}

export default function DocumentSettingsPanel({ settings, resume, onChange }: { settings: DocumentSettings; resume: Resume; onChange: (settings: DocumentSettings) => void }) {
  const set = <K extends keyof DocumentSettings>(key: K, value: DocumentSettings[K]) => onChange({ ...settings, [key]: value });
  const order = effectiveOrder(resume, settings);
  return (
    <div className="rs-editor-grid">
      <TemplatePicker settings={settings} onChange={onChange} />
      <div className="rs-two">
        <Select label="Paper size" value={settings.paper} options={(Object.keys(PAPER) as DocumentSettings["paper"][]).map((value) => ({ value, label: PAPER[value].label }))} onChange={(value) => set("paper", value)} />
        <Select label="Font" value={settings.font} options={(Object.keys(FONT_STACKS) as DocumentSettings["font"][]).map((value) => ({ value, label: FONT_STACKS[value].label }))} onChange={(value) => set("font", value)} />
        <Select label="Body text size" value={settings.fontSize} options={[10, 10.5, 11, 11.5, 12].map((value) => ({ value, label: `${value} pt` }))} onChange={(value) => set("fontSize", value)} />
        <Select label="Page margins" value={settings.margin} options={[0.5, 0.6, 0.75, 0.9, 1].map((value) => ({ value, label: `${value} in` }))} onChange={(value) => set("margin", value)} />
        <Select label="Section spacing" value={settings.sectionSpacing} options={[6, 8, 10, 12, 14].map((value) => ({ value, label: `${value} pt` }))} onChange={(value) => set("sectionSpacing", value)} />
        <Select label="Bullet indent" value={settings.bulletIndent} options={[10, 14, 18, 22].map((value) => ({ value, label: `${value} pt` }))} onChange={(value) => set("bulletIndent", value)} />
        <Select label="Header layout" value={settings.headerLayout} options={[{ value: "center", label: "Centered" }, { value: "left", label: "Left aligned" }]} onChange={(value) => set("headerLayout", value)} />
        <Select label="Page length" value={settings.pagePreference} options={[{ value: "multi", label: "Allow multiple pages" }, { value: "one", label: "Aim for one page" }]} onChange={(value) => set("pagePreference", value)} />
      </div>
      <fieldset className="rs-order">
        <legend>Section order</legend>
        <ol>
          {order.map((key, index) => (
            <li key={key}>
              <span>{sectionTitle(key, resume)}</span>
              <RowActions label={sectionTitle(key, resume)} index={index} count={order.length} onMove={(delta) => set("sectionOrder", move(order, index, delta))} />
            </li>
          ))}
        </ol>
        <small>Empty sections are not printed.</small>
      </fieldset>
    </div>
  );
}

