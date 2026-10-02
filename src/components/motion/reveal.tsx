"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, type ElementType, type ReactNode } from "react";

gsap.registerPlugin(useGSAP);

export const EASE = "power3.out";

/**
 * Staggered entrance for a group. Animates direct children (or `[data-reveal]`
 * descendants when `deep` is set). Skipped entirely for reduced-motion users.
 */
export function Reveal({
  children,
  className,
  as: Tag = "div",
  deep,
  delay = 0,
  stagger = 0.05,
  y = 10,
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  deep?: boolean;
  delay?: number;
  stagger?: number;
  y?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const targets = deep ? ref.current!.querySelectorAll("[data-reveal]") : ref.current!.children;
        if (!targets.length) return;
        gsap.from(targets, { opacity: 0, y, duration: 0.6, ease: EASE, stagger, delay, clearProps: "opacity,transform" });
      });
      return () => mm.revert();
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
