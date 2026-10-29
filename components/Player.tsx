"use client";
import { useEffect, useRef, useState } from "react";
import { draw, DURATION, SIZES, type AdSpec } from "@/lib/ad";
import { canvasFonts } from "@/app/fonts";

/** Loops the ad on a canvas. Holds the last frame when reduced motion is on. */
export function Player({ spec, label, className = "" }: { spec: AdSpec; label: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  const specRef = useRef(spec);
  specRef.current = spec;
  const startRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const fams = [canvasFonts.display.bold, canvasFonts.display.clean, canvasFonts.display.editorial, canvasFonts.mono];
    Promise.all(fams.flatMap((f) => [document.fonts.load(`400 40px ${f}`), document.fonts.load(`800 40px ${f}`)]))
      .catch(() => {})
      .then(() => document.fonts.ready)
      .then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // Restart from zero whenever the words, look or size change.
  useEffect(() => {
    startRef.current = performance.now();
  }, [spec.brand, spec.hook, spec.points.join("|"), spec.cta, spec.look, spec.format, spec.accent, spec.ground]);

  useEffect(() => {
    if (!ready) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let lastSec = -1;
    const tick = () => {
      const s = specRef.current;
      const [W, H] = SIZES[s.format];
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      const t = reduce ? DURATION - 2.5 : ((performance.now() - startRef.current) / 1000) % (DURATION + 1.2);
      draw(ctx, Math.min(t, DURATION), s, canvasFonts);
      const sec = Math.floor(Math.min(t, DURATION));
      if (sec !== lastSec) {
        lastSec = sec;
        setTime(sec);
      }
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [ready, spec.logo, spec.photo]);

  const [W, H] = SIZES[spec.format];
  return (
    <figure className={`player ${className}`}>
      <div className="player-frame" style={{ aspectRatio: `${W} / ${H}`, background: spec.ground }}>
        <canvas ref={ref} width={W} height={H} role="img" aria-label={label} />
      </div>
      <figcaption className="timecode" aria-hidden>
        <span>00:{String(time).padStart(2, "0")}</span>
        <span className="tc-bar"><span style={{ transform: `scaleX(${time / DURATION})` }} /></span>
        <span>00:15</span>
      </figcaption>
    </figure>
  );
}
