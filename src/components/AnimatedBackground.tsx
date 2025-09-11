import React, { useEffect, useRef } from "react";

export default function AnimatedBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);

    const onResize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", onResize);

    const blobs = new Array(6).fill(0).map((_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 120 + Math.random() * 120,
      dx: (Math.random() * 2 - 1) * 0.25,
      dy: (Math.random() * 2 - 1) * 0.25,
      hue: 200 + i * 20,
    }));

    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      const grd = ctx.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, "#ffffff");
      grd.addColorStop(1, "#f7fafc");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      blobs.forEach((b) => {
        b.x += b.dx;
        b.y += b.dy;
        if (b.x < -200 || b.x > w + 200) b.dx *= -1;
        if (b.y < -200 || b.y > h + 200) b.dy *= -1;

        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, `hsla(${b.hue}, 90%, 60%, .18)`);
        g.addColorStop(1, "hsla(0,0%,0%,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "rgba(255,255,255,.06)";
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * w,
          y = Math.random() * h;
        ctx.fillRect(x, y, 1, 1);
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="absolute inset-0 -z-10">
      <canvas ref={ref} className="w-full h-full" />
      <div className="absolute inset-0 bg-grain pointer-events-none" />
    </div>
  );
}
