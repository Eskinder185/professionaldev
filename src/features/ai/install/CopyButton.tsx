import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies text and confirms it, to the eye and to screen readers. Falls back to a message if the browser refuses. */
export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = () => {
    const done = (next: "copied" | "failed") => {
      setState(next);
      window.setTimeout(() => setState("idle"), 2200);
    };
    if (!navigator.clipboard?.writeText) return done("failed");
    navigator.clipboard.writeText(text).then(() => done("copied"), () => done("failed"));
  };
  return (
    <>
      <button type="button" className="cos-btn cos-btn-sm" aria-label={state === "copied" ? `${label}: copied` : label} onClick={copy}>
        {state === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {state === "copied" ? "Copied" : "Copy"}
      </button>
      <span className="cos-sr" role="status" aria-live="polite">{state === "copied" ? "Copied to the clipboard." : state === "failed" ? "Couldn’t copy. Select the text and copy it yourself." : ""}</span>
      {state === "failed" ? <span className="cos-field-error" aria-hidden="true">Couldn’t copy. Select it instead.</span> : null}
    </>
  );
}
