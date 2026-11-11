import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Banner, Card } from "./ui";
import { useModel } from "./lib/context";
import { aiAvailability } from "./lib/ai";
import { captureVisibleTarget } from "./lib/bridge";
import { chatFor } from "../../src/ai/jobAssistant";
import { VISUAL_PROMPT, VISUAL_SCHEMA, VISUAL_SYSTEM, validateVisualReply, visionSupport, visualFallbackReason, type VisualResult } from "../../src/ai/visualPage";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAX_WIDTH = 1280;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The capture couldn’t be displayed."));
    img.src = src;
  });
}

/** Scales the capture down and paints the hidden areas black. Returns a JPEG data URL. */
async function render(src: string, boxes: Box[]): Promise<string> {
  const img = await load(src);
  const scale = Math.min(1, MAX_WIDTH / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The capture couldn’t be prepared.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  for (const b of boxes) ctx.fillRect(b.x * canvas.width, b.y * canvas.height, b.w * canvas.width, b.h * canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export default function VisualCard() {
  const m = useModel();
  const availability = useMemo(() => aiAvailability(m.state?.aiConnection ?? null), [m.state?.aiConnection]);
  const ready = availability.kind === "ready" ? availability : null;
  const vision = visionSupport(ready?.snapshot ?? null);
  const reason = visualFallbackReason(m.page, m.readable);

  const [shot, setShot] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VisualResult | null>(null);
  const abort = useRef<AbortController | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);

  const discard = () => {
    abort.current?.abort();
    setShot(null);
    setBoxes([]);
    setPreview("");
    setDraft(null);
  };

  // The capture belongs to one page; it never survives navigation.
  const pageKey = m.page?.url ?? "";
  useEffect(() => {
    discard();
    setResult(null);
    setError("");
  }, [pageKey]);

  useEffect(() => {
    let live = true;
    if (!shot) return;
    void render(shot, boxes)
      .then((url) => live && setPreview(url))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Preview failed."));
    return () => {
      live = false;
    };
  }, [shot, boxes]);

  const capture = async () => {
    setError("");
    setResult(null);
    setBusy(true);
    try {
      setShot(await captureVisibleTarget(m.tab?.id));
      setBoxes([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture failed.");
    } finally {
      setBusy(false);
    }
  };

  const analyse = async () => {
    if (!ready || !preview) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    try {
      const image = preview.replace(/^data:image\/jpeg;base64,/, "");
      const reply = await chatFor(ready, "job_analysis")(
        [
          { role: "system", content: VISUAL_SYSTEM },
          { role: "user", content: VISUAL_PROMPT, images: [image] },
        ],
        { format: VISUAL_SCHEMA, signal: controller.signal, timeoutMs: 180_000 },
      );
      setResult(validateVisualReply(reply.text, m.page?.fields ?? []));
    } catch (e) {
      setError(controller.signal.aborted ? "Stopped. The picture was discarded." : e instanceof Error ? e.message : "The analysis failed.");
    } finally {
      // The picture is never kept after it has been used.
      setShot(null);
      setBoxes([]);
      setPreview("");
      abort.current = null;
      setBusy(false);
    }
  };

  const point = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const rectOf = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

  const offerable = reason !== null;

  return (
    <Card id="visual" title="Analyze visible page" badge={<Badge tone="neutral">Optional</Badge>}>
      {!offerable ? (
        <p className="muted" data-testid="visual-not-needed">Not needed here. CareerOS read this page directly, which is more accurate than a picture.</p>
      ) : (
        <>
          <p data-testid="visual-reason">{reason}</p>
          <p className="meta">You can take one picture of what’s on screen and have a local vision model describe it. It’s never recorded, never uploaded to the cloud, and shown to you before anything is sent.</p>
          {!ready ? (
            <p className="muted" data-testid="visual-no-model">{availability.kind === "ready" ? "" : availability.reason}</p>
          ) : vision.level === "no" ? (
            <Banner tone="warning" testId="visual-no-vision">{vision.reason}</Banner>
          ) : (
            <p className="meta" data-testid="visual-vision">{vision.reason}</p>
          )}
          {!shot ? (
            <button type="button" className="btn btn-secondary" onClick={() => void capture()} disabled={busy || !ready || vision.level === "no"} data-testid="visual-capture">
              Capture what’s on screen
            </button>
          ) : (
            <div className="review-box" role="group" aria-label="Review the picture before sending" data-testid="visual-review">
              <h3 className="sub-title">Review before sending</h3>
              <p className="meta">
                This picture of the visible part of the page will be sent to <strong>{ready?.snapshot.model}</strong> on this device ({ready?.host}). Hide anything unrelated to the job. It isn’t stored, and it’s discarded when you finish.
              </p>
              <div
                className="shot"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = point(e);
                }}
                onPointerMove={(e) => {
                  if (drag.current) setDraft(rectOf(drag.current, point(e)));
                }}
                onPointerUp={(e) => {
                  if (drag.current) {
                    const box = rectOf(drag.current, point(e));
                    if (box.w > 0.01 && box.h > 0.01) setBoxes((b) => [...b, box]);
                  }
                  drag.current = null;
                  setDraft(null);
                }}
              >
                {preview ? <img src={preview} alt={`Preview of the captured page with ${boxes.length} hidden area${boxes.length === 1 ? "" : "s"}`} draggable={false} data-testid="visual-preview" /> : <span className="meta">Preparing preview…</span>}
                {draft ? <span className="shot-draft" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} /> : null}
              </div>
              <div className="row" role="group" aria-label="Hide parts of the picture">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBoxes((b) => [...b, { x: 0, y: 0, w: 1, h: 0.15 }])}>Hide top</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBoxes((b) => [...b, { x: 0, y: 0.85, w: 1, h: 0.15 }])}>Hide bottom</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBoxes((b) => b.slice(0, -1))} disabled={!boxes.length}>Undo</button>
                <span className="meta" data-testid="visual-hidden-count">{boxes.length} hidden</span>
              </div>
              <p className="meta">Tip: drag on the picture to hide a region.</p>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => void analyse()} disabled={busy || !preview} data-testid="visual-send">Send picture to {ready?.snapshot.model}</button>
                <button type="button" className="btn btn-secondary" onClick={discard} data-testid="visual-discard">Discard</button>
              </div>
            </div>
          )}
          {busy && shot === null && !result ? (
            <div className="running" role="status" data-testid="visual-running">
              <span className="spinner" aria-hidden /> Reading the picture on this device…
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => abort.current?.abort()} data-testid="visual-stop">Stop</button>
            </div>
          ) : null}
        </>
      )}
      <div aria-live="polite">{error ? <Banner tone={error.startsWith("Stopped") ? "info" : "danger"} testId="visual-error">{error}</Banner> : null}</div>
      {result ? (
        <section className="assist-result" data-testid="visual-result" aria-label="What the model saw">
          <h3 className="sub-title">What the model saw</h3>
          {result.summary ? <p>{result.summary}</p> : null}
          <ul className="assist-items">
            {result.observations.map((o, i) => (
              <li key={i} className="assist-item" data-testid="visual-observation">
                <span className="req-term">{o.text}</span> <Badge tone="neutral">{o.kind.replace("_", " ")}</Badge>{" "}
                {o.kind === "form_field" ? o.confirmedByForm ? <Badge tone="success">Matches a field on the page</Badge> : <Badge tone="warning">From the picture only</Badge> : null}
              </li>
            ))}
          </ul>
          {result.rejected ? <p className="meta">{result.rejected} item{result.rejected === 1 ? " was" : "s were"} left out (unreadable, or personal details).</p> : null}
          <p className="meta">This is read-only. CareerOS doesn’t click or fill anything from a picture. Fields marked “from the picture only” aren’t used for autofill.</p>
        </section>
      ) : null}
    </Card>
  );
}
