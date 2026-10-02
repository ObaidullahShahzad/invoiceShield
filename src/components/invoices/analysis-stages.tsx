"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Check, LoaderCircle } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

/**
 * Vertical stepper for the analysis pipeline. Stages reflect what the server reports;
 * the connecting line fills as each one completes.
 */
export function AnalysisStages({ stages, active }: { stages: readonly { key: string; label: string; hint?: string }[]; active: number }) {
  const root = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.to("[data-fill]", { scaleY: (i: number) => (i < active ? 1 : 0), duration: reduce ? 0 : 0.5, ease: "power2.inOut" });
      if (!reduce) gsap.fromTo(`[data-step="${active}"] [data-label]`, { opacity: 0.4, x: -4 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" });
    },
    { scope: root, dependencies: [active] },
  );

  return (
    <ol ref={root} className="space-y-0">
      {stages.map((s, i) => {
        const done = i < active;
        const now = i === active;
        return (
          <li key={s.key} data-step={i} className="relative flex gap-3 pb-5 last:pb-0">
            {i < stages.length - 1 ? (
              <span aria-hidden className="absolute top-6 bottom-0.5 left-[11px] w-px overflow-hidden bg-line">
                <span data-fill className="block h-full w-full bg-ink" style={{ transform: "scaleY(0)", transformOrigin: "top" }} />
              </span>
            ) : null}
            <span
              className={cn(
                "relative grid size-[23px] shrink-0 place-items-center rounded-full border text-[11px] font-medium transition-colors duration-300",
                done ? "border-ink bg-ink text-white" : now ? "border-ink bg-surface text-ink" : "border-line-strong bg-surface text-subtle",
              )}
            >
              {done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : now ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : i + 1}
            </span>
            <div data-label className={cn("pt-0.5 text-[13px] leading-5", !done && !now && "text-subtle")}>
              <p className={cn(now && "font-medium text-ink", done && "text-ink-2")}>{s.label}</p>
              {s.hint && now ? <p className="text-xs text-muted">{s.hint}</p> : null}
              <span className="sr-only">{done ? "done" : now ? "in progress" : "waiting"}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
