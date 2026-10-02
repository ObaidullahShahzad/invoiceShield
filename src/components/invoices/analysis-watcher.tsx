"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnalysisStages } from "@/components/invoices/analysis-stages";
import { ScanVisual } from "@/components/loader/brand-loader";
import { Card } from "@/components/ui/card";

const STAGES = [
  { key: "extracting", label: "Extracting fields", hint: "Reading vendor, amounts and bank details" },
  { key: "checking", label: "Running checks", hint: "Comparing against history and the vendor register" },
  { key: "explaining", label: "Preparing summary", hint: "Writing a plain-language explanation" },
];

/** Shown while an analysis is running; polls real server status and refreshes the page when it finishes. */
export function AnalysisWatcher({ invoiceId, initial }: { invoiceId: string; initial: string }) {
  const router = useRouter();
  const [stage, setStage] = useState(initial);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/status`, { cache: "no-store" });
        const json = await res.json();
        if (stop) return;
        const s = json.data?.analysisStatus as string | undefined;
        if (s === "completed" || s === "failed") {
          router.refresh();
          return;
        }
        if (s) setStage(s);
      } catch {
        /* keep polling */
      }
      if (!stop) setTimeout(tick, 900);
    };
    const t = setTimeout(tick, 600);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [invoiceId, router]);

  const active = Math.max(0, STAGES.findIndex((s) => s.key === stage));
  return (
    <Card className="mb-5 overflow-hidden" role="status" aria-live="polite">
      <div className="grid items-stretch sm:grid-cols-[240px_1fr]">
        <ScanVisual className="hidden border-r border-line bg-sunken/60 sm:grid" />
        <div className="p-5">
          <p className="text-sm font-semibold tracking-[-0.01em]">Analysis in progress</p>
          <p className="mb-4 text-[12.5px] text-muted">This page will update automatically when it finishes.</p>
          <AnalysisStages stages={STAGES} active={active} />
        </div>
      </div>
    </Card>
  );
}
