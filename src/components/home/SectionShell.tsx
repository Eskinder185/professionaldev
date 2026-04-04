import React from "react";

type Props = {
  id?: string;
  children: React.ReactNode;
  className?: string;
  /** Extra vertical rhythm */
  dense?: boolean;
};

export default function SectionShell({ id, children, className = "", dense }: Props) {
  return (
    <section
      id={id}
      className={[
        "mx-auto w-full max-w-content px-4 sm:px-6",
        dense ? "py-section-sm md:py-16" : "py-section-sm md:py-section",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}
