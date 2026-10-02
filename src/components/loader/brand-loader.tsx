"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const DEFAULT_MESSAGES = ["Preparing your workspace", "Loading invoices", "Checking the evidence"];

/** Logo stroke draws itself, then a thin indeterminate bar. Quiet by design. */
export function BrandLoader({ variant = "panel", messages = DEFAULT_MESSAGES }: { variant?: "screen" | "panel"; messages?: string[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), 1800);
    return () => clearInterval(t);
  }, [messages.length]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const paths = gsap.utils.toArray<SVGPathElement>("[data-draw]");
        paths.forEach((p) => {
          const len = p.getTotalLength();
          gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
        });
        gsap
          .timeline({ repeat: -1, repeatDelay: 0.25 })
          .to(paths, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut", stagger: 0.18 })
          .to(paths, { strokeDashoffset: (_, el: SVGPathElement) => -el.getTotalLength(), duration: 0.9, ease: "power2.in", stagger: 0.1 }, "+=0.35");
        gsap.from("[data-loader-text]", { opacity: 0, y: 6, duration: 0.6, ease: "power3.out", delay: 0.1 });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={cn("flex flex-col items-center justify-center bg-canvas", variant === "screen" ? "fixed inset-0 z-[60]" : "min-h-[calc(100vh-12rem)]")}
    >
      <div className="grid size-14 place-items-center rounded-2xl border border-line bg-surface shadow-card">
        <svg viewBox="0 0 24 24" className="size-7 text-ink" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path data-draw d="M12 2.8 4.5 5.6v5.9c0 4.6 3.1 8.2 7.5 9.7 4.4-1.5 7.5-5.1 7.5-9.7V5.6L12 2.8Z" />
          <path data-draw d="M8.8 10.2h6.4" />
          <path data-draw d="M8.8 13.6h4.2" />
        </svg>
      </div>
      <div data-loader-text className="mt-5 text-center">
        <p key={i} className="h-5 text-[13px] text-muted">{messages[i]}…</p>
      </div>
      <div className="mt-4 h-0.5 w-32 overflow-hidden rounded-full bg-line">
        <div className="animate-sweep h-full w-1/3 rounded-full bg-ink/70" />
      </div>
    </div>
  );
}

/**
 * Document outline with a scan line passing over it. Used while an invoice is being analysed.
 * Static (no scan line) for reduced-motion users.
 */
export function ScanVisual({ className }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo("[data-scan]", { yPercent: 0 }, { yPercent: 1550, duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true });
        gsap.fromTo(
          "[data-row]",
          { opacity: 0.35 },
          { opacity: 1, duration: 0.5, stagger: { each: 0.12, repeat: -1, yoyo: true }, ease: "sine.inOut" },
        );
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} aria-hidden className={cn("bg-dots relative grid place-items-center overflow-hidden", className)}>
      <div className="relative h-40 w-32 overflow-hidden rounded-lg border border-line-strong bg-surface p-3.5 shadow-pop">
        <div className="flex items-center justify-between">
          <div className="h-2 w-10 rounded-sm bg-ink/80" />
          <div className="h-1.5 w-6 rounded-sm bg-line-strong" />
        </div>
        <div className="mt-4 space-y-2">
          {[88, 64, 76, 52].map((w, i) => (
            <div key={i} data-row className="h-1.5 rounded-sm bg-line-strong" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="mt-4 space-y-1.5 border-t border-line pt-2.5">
          {[0, 1].map((r) => (
            <div key={r} className="flex justify-between">
              <div data-row className="h-1.5 w-8 rounded-sm bg-line-strong" />
              <div data-row className="h-1.5 w-6 rounded-sm bg-line-strong" />
            </div>
          ))}
          <div className="flex justify-between pt-1">
            <div className="h-2 w-8 rounded-sm bg-ink/70" />
            <div className="h-2 w-9 rounded-sm bg-ink/70" />
          </div>
        </div>
        <div data-scan className="absolute inset-x-0 top-0 h-2.5">
          <div className="h-px w-full bg-accent shadow-[0_0_12px_2px_rgb(58_85_200/0.35)]" />
          <div className="h-2 w-full bg-gradient-to-b from-accent/10 to-transparent" />
        </div>
      </div>
    </div>
  );
}
