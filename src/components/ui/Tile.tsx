import React from "react";
import { Link } from "react-router-dom";

export default function Tile({
  title, desc, tags, to, href, className = ""
}: {
  title: string;
  desc: string;
  tags?: string[];
  to?: string;
  href?: string;
  className?: string;
}) {
  const Button = () =>
    href ? (
      <a href={href} target="_blank" rel="noreferrer" className="btn btn-anim btn-pink">Open tool →</a>
    ) : (
      <Link to={to || "#"} className="btn btn-anim btn-pink">Open tool →</Link>
    );

  return (
    <div className={`surface p-5 hover-glow ${className}`}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1">{desc}</p>
      {tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">{tags.map(t => <span key={t} className="chip">{t}</span>)}</div>
      ) : null}
      <div className="mt-4"><Button /></div>
    </div>
  );
}

