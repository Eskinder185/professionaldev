import React, { useEffect, useRef, useState } from "react";

export default function TeleprompterRecorder({ script }: { script: string }) {
  const [speed, setSpeed] = useState(28); // px/s
  const [font, setFont] = useState(26);
  const [mirror, setMirror] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaURL, setMediaURL] = useState<string | undefined>();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    const el = scrollerRef.current!;
    let y = 0,
      raf = 0;
    const step = () => {
      y += speed / 60;
      el.scrollTop = y;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed, script]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (mediaRef.current) mediaRef.current.srcObject = stream;
    const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType });
      setMediaURL(URL.createObjectURL(blob));
      (stream.getTracks() || []).forEach((t) => t.stop());
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
  }
  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="surface p-4">
        <div className="flex items-center gap-3 mb-3">
          <label className="text-sm">Speed</label>
          <input type="range" min={10} max={60} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
          <label className="text-sm ml-3">Font</label>
          <input type="range" min={18} max={40} value={font} onChange={(e) => setFont(+e.target.value)} />
          <label className="text-sm ml-3 inline-flex items-center gap-1">
            <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror
          </label>
        </div>

        <div className="h-[320px] overflow-y-auto surface-muted p-6 rounded-xl" ref={scrollerRef} style={{ direction: mirror ? "rtl" : "ltr" }}>
          <div className="leading-[1.6] tracking-wide" style={{ fontSize: font, transform: mirror ? "scaleX(-1)" : "none" }}>
            {script.split(" ").map((w, i) => (
              <span key={i} className="mx-[4px]">
                {w}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {!recording ? (
            <button className="btn btn-primary" onClick={startRecording}>
              Start recording
            </button>
          ) : (
            <button className="btn" onClick={stopRecording}>
              Stop & save
            </button>
          )}
          {mediaURL && (
            <a className="btn" href={mediaURL} download="elevator-practice.webm">
              Download
            </a>
          )}
        </div>
        <div className="text-xs opacity-70 mt-2">Tip: Aim for 30–45s. Practice until it feels smooth and natural.</div>
      </div>

      <div className="surface p-4">
        <video ref={mediaRef} className="w-full rounded-xl" autoPlay muted playsInline />
        <div className="text-sm opacity-80 mt-2">Camera preview (records when you click “Start”).</div>
      </div>
    </div>
  );
}

