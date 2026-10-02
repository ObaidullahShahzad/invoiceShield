"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { formatMoney } from "@/lib/domain/money";

gsap.registerPlugin(useGSAP);

type Format = { kind: "number" } | { kind: "money"; currency: string; compact?: boolean } | { kind: "percent" };

function render(v: number, f: Format) {
  if (f.kind === "money") return formatMoney(Math.round(v), f.currency, { compact: f.compact });
  if (f.kind === "percent") return `${Math.round(v)}%`;
  return Math.round(v).toLocaleString("en-US");
}

/** Counts up to `value` once on mount. Server-renders the final value, so there is no layout shift or empty state. */
export function AnimatedNumber({ value, format = { kind: "number" }, className }: { value: number; format?: Format; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const o = { v: 0 };
        gsap.to(o, {
          v: value,
          duration: 1.1,
          ease: "power2.out",
          onUpdate: () => {
            if (ref.current) ref.current.textContent = render(o.v, format);
          },
        });
      });
      return () => mm.revert();
    },
    { dependencies: [value] },
  );
  return (
    <span ref={ref} className={className}>
      {render(value, format)}
    </span>
  );
}
