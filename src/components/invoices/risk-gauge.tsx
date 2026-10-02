"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { RISK_LABEL } from "@/lib/domain/scoring";
import type { RiskLevel } from "@/lib/domain/types";

gsap.registerPlugin(useGSAP);

const COLOR: Record<RiskLevel, string> = { low: "#2e7650", medium: "#9a6408", high: "#b8501d", critical: "#b4232b" };
const TICKS = 40;

/**
 * Segmented arc gauge. The filled segments sweep in on mount.
 * Score and level are always given as text, so colour is never the only signal.
 */
export function RiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  const root = useRef<HTMLDivElement>(null);
  const filled = Math.round((Math.min(100, Math.max(0, score)) / 100) * TICKS);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-on]", { opacity: 0, duration: 0.25, stagger: 0.022, ease: "none" });
        const o = { v: 0 };
        gsap.to(o, {
          v: score,
          duration: 0.022 * filled + 0.25,
          ease: "power1.out",
          onUpdate: () => {
            const el = root.current?.querySelector("[data-score]");
            if (el) el.textContent = String(Math.round(o.v));
          },
        });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [score] },
  );

  // 40 short radial ticks across a 180° arc.
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const a = Math.PI - (i / (TICKS - 1)) * Math.PI;
    const r1 = 62;
    const r2 = 76;
    return { x1: 90 + r1 * Math.cos(a), y1: 86 - r1 * Math.sin(a), x2: 90 + r2 * Math.cos(a), y2: 86 - r2 * Math.sin(a), on: i < filled };
  });

  return (
    <div ref={root} className="relative mx-auto w-full max-w-60">
      <svg viewBox="0 0 180 96" className="w-full" role="img" aria-label={`Review risk score ${score} out of 100, ${RISK_LABEL[level]}`}>
        {ticks.map((t, i) => (
          <line key={i} {...(t.on ? { "data-on": "" } : {})} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.on ? COLOR[level] : "#e6e6ea"} strokeWidth={2.4} strokeLinecap="round" />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="tnum text-[34px] leading-none font-semibold tracking-[-0.04em]">
          <span data-score>{score}</span>
          <span className="ml-0.5 text-sm font-medium tracking-normal text-subtle">/100</span>
        </p>
      </div>
    </div>
  );
}
