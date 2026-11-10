import { forwardRef, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { DocumentSettings, Resume } from "../model/types";
import { FONT_STACKS, PAPER } from "../model/defaults";
import { buildBlocks, renderBlocks, type DocBlock } from "./blocks";

const PX_PER_IN = 96;

/**
 * Split measured blocks into pages. `tops`/`bottoms` come from one continuous
 * layout at the page's content width, so margins between blocks are included.
 */
export function paginate(blocks: Pick<DocBlock, "keepWithNext">[], tops: number[], bottoms: number[], contentHeight: number): number[][] {
  if (!blocks.length) return [[]];
  const pages: number[][] = [[]];
  let pageStart = tops[0] ?? 0;
  for (let index = 0; index < blocks.length; index++) {
    const page = pages[pages.length - 1];
    const overflows = bottoms[index] - pageStart > contentHeight + 0.5;
    if (overflows && page.length) {
      // Carry trailing "keep with next" blocks (headings, entry titles) to the new page.
      const carried: number[] = [];
      while (page.length > 1 && blocks[page[page.length - 1]].keepWithNext) carried.unshift(page.pop()!);
      pages.push([...carried, index]);
      pageStart = tops[carried[0] ?? index];
    } else page.push(index);
  }
  return pages;
}

export function documentStyle(settings: DocumentSettings): CSSProperties {
  const paper = PAPER[settings.paper];
  return {
    "--rd-font": FONT_STACKS[settings.font].css,
    "--rd-size": `${settings.fontSize}pt`,
    "--rd-section-space": `${settings.sectionSpacing}pt`,
    "--rd-indent": `${settings.bulletIndent}pt`,
    "--rd-margin": `${settings.margin}in`,
    "--rd-page-w": `${paper.widthIn}in`,
    "--rd-page-h": `${paper.heightIn}in`,
  } as CSSProperties;
}

type Props = {
  resume: Resume;
  settings: DocumentSettings;
  zoom: number;
  printing?: boolean;
  onPagesChange?: (count: number) => void;
};

const ResumeDocument = forwardRef<HTMLDivElement, Props>(function ResumeDocument({ resume, settings, zoom, printing, onPagesChange }, ref) {
  const blocks = useMemo(() => buildBlocks(resume, settings), [resume, settings]);
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][]>([blocks.map((_, index) => index)]);
  const paper = PAPER[settings.paper];
  const contentHeight = (paper.heightIn - settings.margin * 2) * PX_PER_IN;
  const className = `rd-doc rd-tpl-${settings.template} rd-header-${settings.headerLayout}`;
  const style = documentStyle(settings);

  useLayoutEffect(() => {
    const measure = () => {
      const root = measureRef.current;
      if (!root) return;
      const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-block]"));
      const origin = root.getBoundingClientRect().top;
      const tops: number[] = [];
      const bottoms: number[] = [];
      elements.forEach((element) => {
        const index = Number(element.dataset.block);
        const rect = element.getBoundingClientRect();
        tops[index] = rect.top - origin;
        bottoms[index] = rect.bottom - origin;
      });
      const next = paginate(blocks, tops, bottoms, contentHeight);
      setPages((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    measure();
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && measure()).catch(() => undefined);
    // Re-measure when the preview becomes visible (e.g. switching mobile tabs) or fonts swap.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    if (measureRef.current) observer?.observe(measureRef.current);
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [blocks, contentHeight, settings]);

  const pageCount = pages.length;
  useLayoutEffect(() => onPagesChange?.(pageCount), [pageCount, onPagesChange]);

  const indexOf = (block: DocBlock) => blocks.indexOf(block);
  const renderPages = (forPrint = false) =>
    pages.map((page, pageIndex) => (
      <article
        key={pageIndex}
        className="rd-page"
        aria-label={forPrint ? undefined : `Page ${pageIndex + 1} of ${pageCount}`}
        data-page={pageIndex + 1}
      >
        <div className="rd-page-content">{renderBlocks(page.map((index) => blocks[index]).filter(Boolean), indexOf)}</div>
        {!forPrint && pageCount > 1 ? <span className="rd-page-number" aria-hidden="true">{pageIndex + 1} / {pageCount}</span> : null}
      </article>
    ));

  return (
    <>
      <div className={className} style={style} ref={ref}>
        <div className="rd-pages" style={{ zoom } as CSSProperties}>
          {renderPages()}
        </div>
        <div className="rd-measure" aria-hidden="true">
          <div className="rd-page-content" ref={measureRef}>
            {renderBlocks(blocks, indexOf)}
          </div>
        </div>
      </div>
      {printing
        ? createPortal(
            <div id="resume-print-root" className={className} style={style}>
              <style>{`@page { size: ${settings.paper === "a4" ? "A4" : "letter"}; margin: 0; }`}</style>
              {renderPages(true)}
            </div>,
            document.body,
          )
        : null}
    </>
  );
});

export default ResumeDocument;
