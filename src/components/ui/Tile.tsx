import React from "react";
import { Link } from "react-router-dom";

type Variant = "orange" | "blue" | "purple";

export default function Tile({
  title, desc, tags, to, href, variant = "blue", className = ""
}: {
  title: string;
  desc: string;
  tags?: string[];
  to?: string;
  href?: string;
  variant?: Variant;
  className?: string;
}) {
  const glow = variant === "orange" ? "var(--accent-orange)"
             : variant === "purple" ? "var(--accent-purple)"
             : "var(--accent-blue)";
  const btnVariant = variant === "orange" ? "btn-or"
                  : variant === "purple" ? "btn-purple" : "btn-blue";

  const Button = () =>
    href ? (
      <a href={href} target="_blank" rel="noreferrer" className={`btn btn-anim ${btnVariant}`}>Open tool →</a>
    ) : (
      <Link to={to || "#"} className={`btn btn-anim ${btnVariant}`}>Open tool →</Link>
    );

  return (
    <div className={`surface p-5 hover-glow fade-up ${className}`} style={{ ["--glow" as any]: glow }}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1">{desc}</p>
      {tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map(t => <span key={t} className="chip">{t}</span>)}
        </div>
      ) : null}
      <div className="mt-4"><Button /></div>
    </div>
  );
}

