import React from "react";
import { Link } from "react-router-dom";

type IconProps = { className?: string };
const Sparkles = ({ className = "h-5 w-5" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 3l1.5 3L10 7.5 6.5 9 5 12 3.5 9 0 7.5 3.5 6 5 3z" transform="translate(7 3)" />
    <path d="M3 16l.8 1.6L6 18.4 4.4 19.2 3 21 2 19.2 0 18.4 2 17.6 3 16z" transform="translate(13 1)" />
  </svg>
);
const ArrowRight = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
  </svg>
);
const IconLib: Record<string, (p: IconProps) => JSX.Element> = new Proxy({ Sparkles, ArrowRight }, {
  get(target, prop: string) {
    return (target as any)[prop] ?? ((p: IconProps) => <Sparkles {...p} />);
  },
});

type Item = {
  title: string;
  blurb: string;
  href: string;
  icon?: string;
  tags?: string[];
  details?: string[]; // shown on hover
  accent?: "orange" | "blue" | "purple" | "emerald";
};

export default function FeatureSection({
  heading,
  subheading,
  items,
}: {
  heading: string;
  subheading?: string;
  items: Item[];
}) {
  return (
    <section className="relative">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight">{heading}</h2>
        {subheading && <p className="text-white/70 mt-1">{subheading}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, idx) => {
          const Icon = it.icon ? IconLib[it.icon] : IconLib.Sparkles;
          const grad =
            it.accent === "orange"
              ? "from-orange-500/20 to-pink-500/20"
              : it.accent === "purple"
              ? "from-violet-500/20 to-indigo-500/20"
              : it.accent === "emerald"
              ? "from-emerald-500/20 to-teal-500/20"
              : "from-sky-500/20 to-blue-500/20";

          return (
            <div
              key={idx}
              className={`group relative rounded-2xl transition transform hover:-translate-y-1 active:scale-95`}
            >
              <Link
                to={it.href}
                className={`block relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur`}
              >
              {/* soft gradient wash */}
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${grad} opacity-0 group-hover:opacity-100 transition`} />
              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-black/30 p-2 border border-white/10">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-semibold">{it.title}</h3>
                </div>

                <p className="mt-3 text-white/80 text-sm leading-relaxed">
                  {it.blurb}
                </p>

                {/* tags */}
                {it.tags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {it.tags.map((t, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs text-white/90"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* hover details */}
                {it.details?.length ? (
                  <div className="mt-4 max-h-0 overflow-hidden text-sm text-white/85 transition-all duration-300 group-hover:max-h-48">
                    <ul className="list-disc pl-5 space-y-1">
                      {it.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-sm font-medium border border-white/15 group-hover:bg-white/15">
                    Open tool
                    <ArrowRight className="h-4 w-4 transition -translate-x-0 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
