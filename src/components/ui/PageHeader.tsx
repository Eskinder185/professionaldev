import React from "react";

export default function PageHeader({title, sub}:{title:string; sub?:string}) {
  return (
    <header className="surface-muted p-6">
      <h1 className="brand-heading text-2xl font-semibold">{title}</h1>
      {sub && <p className="mt-1">{sub}</p>}
    </header>
  );
}
