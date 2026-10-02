"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { FileSearch, Fingerprint, Lock, ScrollText } from "lucide-react";
import { useRef } from "react";
import { BrandMark } from "@/components/layout/brand";

gsap.registerPlugin(useGSAP);

const points = [
  { icon: FileSearch, title: "Evidence beside every flag", text: "Each finding shows the exact values and the earlier record it was compared with." },
  { icon: Fingerprint, title: "Deterministic checks first", text: "Duplicates, arithmetic and bank-detail changes come from rules, not model guesses." },
  { icon: ScrollText, title: "People decide, everything is logged", text: "Reviewer actions require context and land in an append-only audit trail." },
];

export function LoginAside() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "power3.out", duration: 0.8 } })
          .from("[data-a='head']", { opacity: 0, y: 16 })
          .from("[data-a='lede']", { opacity: 0, y: 12 }, "-=0.6")
          .from("[data-a='point']", { opacity: 0, y: 10, stagger: 0.09 }, "-=0.5")
          .from("[data-a='rule']", { scaleX: 0, transformOrigin: "left", duration: 1.1, ease: "power2.inOut" }, 0.2);
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <aside ref={root} className="relative hidden flex-col justify-between overflow-hidden bg-[#0c0c0e] p-12 text-white lg:flex">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(80%_70%_at_30%_20%,black,transparent)]" aria-hidden />
      <div className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full bg-white/[0.035] blur-3xl" aria-hidden />

      <BrandMark inverted className="relative" />

      <div className="relative max-w-[440px]">
        <p data-a="head" className="text-[11px] font-medium tracking-[0.14em] text-white/40 uppercase">
          Accounts payable review
        </p>
        <h1 data-a="head" className="mt-4 text-[34px] leading-[1.12] font-semibold tracking-[-0.03em]">
          Review invoices with the evidence in front of you.
        </h1>
        <p data-a="lede" className="mt-4 text-[14.5px] leading-relaxed text-white/55">
          InvoiceShield highlights duplicates, vendor mismatches and unusual amounts before payment review. It flags anomalies — it never approves or blocks a payment.
        </p>
        <div data-a="rule" className="my-9 h-px bg-white/10" />
        <ul className="space-y-6">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title} data-a="point" className="flex gap-4">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-white/75">
                <Icon className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <p className="text-[13.5px] font-medium">{title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-white/45">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative flex items-center gap-2 text-xs text-white/35">
        <Lock className="size-3.5" aria-hidden /> Invoice content is analysed on infrastructure you control.
      </p>
    </aside>
  );
}
