import React, { useRef } from "react";
import { Link } from "react-router-dom";

/** Animated tile: float-in, expand on hover with orange glow, and shine highlight. */
export default function MotionTile({
  title, desc, tags, to, href, delay = 0
}: {
  title: string;
  desc: string;
  tags?: string[];
  to?: string;
  href?: string;
  delay?: number; // 0,1,2… for stagger
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // shine hotspot
    card.style.setProperty("--mx", `${x}px`);
    card.style.setProperty("--my", `${y}px`);
  }
  function onLeave() {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--mx", `50%`);
    card.style.setProperty("--my", `50%`);
  }

  const Content = () => {
    if (href) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className="block h-full">
          <h3 className="text-lg font-semibold translate-z-[30px] will-change-transform">{title}</h3>
          <p className="mt-1 translate-z-[20px] will-change-transform">{desc}</p>
          {tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-2 translate-z-[14px] will-change-transform">
              {tags.map(t => <span key={t} className="chip">{t}</span>)}
            </div>
          ) : null}
        </a>
      );
    }
    return (
      <Link to={to || "#"} className="block h-full">
        <h3 className="text-lg font-semibold translate-z-[30px] will-change-transform">{title}</h3>
        <p className="mt-1 translate-z-[20px] will-change-transform">{desc}</p>
        {tags?.length ? (
          <div className="mt-3 flex flex-wrap gap-2 translate-z-[14px] will-change-transform">
            {tags.map(t => <span key={t} className="chip">{t}</span>)}
          </div>
        ) : null}
      </Link>
    );
  };

  return (
    <div
      className="tilt-3d float-in stagger"
      style={{ ["--d" as any]: delay }}
    >
      <div
        ref={cardRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="surface p-5 rounded-2xl hover-expand-orange shine tile-3d bob h-full transition-all duration-300 ease-out"
      >
        <Content />
      </div>
    </div>
  );
}
