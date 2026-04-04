import React from "react";

type Props = {
  title: string;
  hint?: string;
  children?: React.ReactNode;
  className?: string;
};

/** Empty / placeholder — typographic, no card frame */
export default function EmptyState({ title, hint, children, className = "" }: Props) {
  return (
    <div
      className={[
        "flex min-h-[10rem] flex-col items-center justify-center border-b border-dashed border-black/[0.1] px-4 py-10 text-center dark:border-white/[0.12]",
        className,
      ].join(" ")}
    >
      <p className="text-sm font-medium text-ink dark:text-white">{title}</p>
      {hint ? <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">{hint}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
