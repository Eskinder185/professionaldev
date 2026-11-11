import { forwardRef, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { DocumentSettings, Resume } from "../model/types";
import { layoutResume } from "../layout/engine";
import { defaultMeasurer, loadMeasurer, type Measurer } from "../layout/measurer";
import { CSS_FAMILY, FONT_FAMILY } from "../layout/templates";
import type { FitReport, LayoutPage, LayoutResult, PlacedLine } from "../layout/types";

const PT = 96 / 72;

/** Loads the font metrics used for layout. Resolves once, then layout is synchronous. */
export function useMeasurer(): Measurer | null {
  const [measurer, setMeasurer] = useState<Measurer | null>(null);
  useEffect(() => {
    let live = true;
    loadMeasurer().then((m) => live && setMeasurer(() => m));
    return () => {
      live = false;
    };
  }, []);
  return measurer;
}

export function useLayout(resume: Resume, settings: DocumentSettings): LayoutResult {
  const measurer = useMeasurer();
  return useMemo(() => layoutResume(resume, settings, measurer ?? defaultMeasurer), [measurer, resume, settings]);
}

function LineBox({ line }: { line: PlacedLine }) {
  const style: CSSProperties = {
    top: line.y * PT,
    height: line.height * PT,
    lineHeight: `${line.height * PT}px`,
    fontSize: `${line.size * PT}px`,
    color: line.color ?? "#000",
  };
  const className = `rd-line rd-line-${line.paraKind}`;
  const children = (
    <>
      {line.glyph ? (
        <span className="rd-glyph" aria-hidden="true" style={{ left: line.glyph.x * PT }}>
          {line.glyph.text}
        </span>
      ) : null}
      {line.runs.map((run, i) => (
        <span
          key={i}
          className="rd-run"
          style={{
            left: run.x * PT,
            fontWeight: run.style.includes("bold") ? 700 : 400,
            fontStyle: run.style.includes("italic") ? "italic" : "normal",
          }}
        >
          {run.text}
        </span>
      ))}
    </>
  );
  if (line.paraKind === "name") return <h1 className={className} data-kind={line.paraKind} style={style}>{children}</h1>;
  if (line.paraKind === "heading") return <h2 className={className} data-kind={line.paraKind} style={style}>{children}</h2>;
  if (line.paraKind === "summary" || line.paraKind === "skill" || line.paraKind === "paragraph" || line.paraKind === "headline" || line.paraKind === "contact" || line.paraKind === "cert") {
    return <p className={className} data-kind={line.paraKind} style={style}>{children}</p>;
  }
  return <div className={className} data-kind={line.paraKind} style={style}>{children}</div>;
}

const paraKeyOf = (lineKey: string) => lineKey.replace(/:\d+$/, "");
const listGroupOf = (lineKey: string) => paraKeyOf(lineKey).replace(/-b\d+$/, "");

function renderPageLines(lines: PlacedLine[]): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.paraKind === "bullet") {
      const group = listGroupOf(line.key);
      const groupLines: PlacedLine[] = [];
      while (i < lines.length && lines[i].paraKind === "bullet" && listGroupOf(lines[i].key) === group) {
        groupLines.push(lines[i++]);
      }
      i--;
      const bullets: PlacedLine[][] = [];
      for (const gl of groupLines) {
        const last = bullets[bullets.length - 1];
        if (last && paraKeyOf(last[0].key) === paraKeyOf(gl.key)) last.push(gl);
        else bullets.push([gl]);
      }
      out.push(
        <ul key={`list-${line.key}`} className="rd-bullets" role="list">
          {bullets.map((bLines) => (
            <li key={paraKeyOf(bLines[0].key)} className="rd-bullet-item" role="listitem">
              {bLines.map((bl) => (
                <LineBox key={bl.key} line={bl} />
              ))}
            </li>
          ))}
        </ul>,
      );
    } else {
      out.push(<LineBox key={line.key} line={line} />);
    }
  }
  return out;
}

function Page({ page, layout, index, count, forPrint }: { page: LayoutPage; layout: LayoutResult; index: number; count: number; forPrint?: boolean }) {
  const family = CSS_FAMILY[layout.family];
  return (
    <article
      className="rd-page"
      aria-label={forPrint ? undefined : `Page ${index + 1} of ${count}`}
      data-page={index + 1}
      style={{ width: `${layout.page.widthPt * PT}px`, height: `${layout.page.heightPt * PT}px`, fontFamily: family, ["--rd-page-h" as string]: `${layout.page.heightPt * PT}px` } as CSSProperties}
    >
      {page.rules.map((rule, i) => (
        <span key={`r${i}`} className="rd-rule" aria-hidden="true" style={{ left: rule.x1 * PT, top: rule.y * PT, width: (rule.x2 - rule.x1) * PT, borderTop: `${rule.width * PT}px solid ${rule.color}` }} />
      ))}
      {renderPageLines(page.lines)}
      {!forPrint && count > 1 ? (
        <span className="rd-page-number" aria-hidden="true">
          {index + 1} / {count}
        </span>
      ) : null}
    </article>
  );
}

type Props = {
  resume: Resume;
  settings: DocumentSettings;
  zoom: number;
  printing?: boolean;
  onPagesChange?: (count: number) => void;
  onFitChange?: (fit: FitReport | null, layout: LayoutResult | null) => void;
};

/**
 * The live document. Lines are placed by the layout engine at absolute
 * positions, the same positions the PDF export uses, so the preview is the
 * document, not an approximation of it.
 */
const ResumeDocument = forwardRef<HTMLDivElement, Props>(function ResumeDocument({ resume, settings, zoom, printing, onPagesChange, onFitChange }, ref) {
  const layout = useLayout(resume, settings);
  const pageCount = layout.pages.length;
  useEffect(() => onPagesChange?.(pageCount), [pageCount, onPagesChange]);
  useEffect(() => onFitChange?.(layout.fit, layout), [layout, onFitChange]);
  const style = { "--rd-family": CSS_FAMILY[FONT_FAMILY[settings.font]] } as CSSProperties;

  const className = `rd-doc rd-tpl-${settings.template}`;
  return (
    <>
      <div className={className} style={style} ref={ref}>
        <div className="rd-pages" style={{ zoom } as CSSProperties}>
          {layout.pages.map((page, index) => (
            <Page key={index} page={page} layout={layout} index={index} count={layout.pages.length} />
          ))}
        </div>
      </div>
      {printing
        ? createPortal(
            <div id="resume-print-root" className={className} style={style}>
              <style>{`@page { size: ${settings.paper === "a4" ? "A4" : "letter"}; margin: 0; }`}</style>
              {layout.pages.map((page, index) => (
                <Page key={index} page={page} layout={layout} index={index} count={layout.pages.length} forPrint />
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
});

export default ResumeDocument;
