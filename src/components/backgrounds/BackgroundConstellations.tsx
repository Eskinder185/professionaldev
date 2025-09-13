import React, { useEffect, useRef } from "react";

export default function BackgroundConstellations() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    function size() {
      canvas.width = Math.floor(window.innerWidth * DPR);
      canvas.height = Math.floor(window.innerHeight * DPR);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    size();
    window.addEventListener("resize", size);

    function drawUnderlay() {
      const w = canvas.width / DPR, h = canvas.height / DPR;
      const bg = css.getPropertyValue("--bg").trim() || "#0b0f1a";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    let N = Math.min(140, Math.floor((window.innerWidth * window.innerHeight) / 18000));
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
    }));

    const css = getComputedStyle(document.documentElement);
    const star = css.getPropertyValue("--star").trim() || "#8fb3ff";
    const link = css.getPropertyValue("--link").trim() || "#334b7e";
    const colors = [star];

    let raf = 0;
    const R = 140;

    function frame() {
      drawUnderlay();

      // links
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            const a = 1 - d2 / (R * R);
            ctx.strokeStyle = link;
            ctx.globalAlpha = 0.22 * a;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      // points
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > window.innerWidth) p.vx *= -1;
        if (p.y < 0 || p.y > window.innerHeight) p.vy *= -1;

        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", size); };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 -z-10 pointer-events-none" />;
}
