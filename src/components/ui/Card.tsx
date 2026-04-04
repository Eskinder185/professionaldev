import React, { PropsWithChildren } from "react";
import { CardShell } from "./cards";

/** Generic container; prefer `FeatureCard`, `ToolCard`, etc. from `./cards` for homepage patterns. */
export default function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return (
    <CardShell interactive className={className}>
      {children}
    </CardShell>
  );
}
