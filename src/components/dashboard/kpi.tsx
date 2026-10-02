import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One segment of the KPI strip. Lives inside <KpiStrip>, which draws the dividers. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
  emphasis,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  delta?: number | null;
  hint?: ReactNode;
  /** Draws a small red marker when the metric needs attention. */
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0 px-5 py-4">
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
        <Icon className="size-3.5 text-subtle" strokeWidth={2} aria-hidden />
        {label}
        {emphasis ? <span className="size-1.5 rounded-full bg-critical" aria-label="needs attention" /> : null}
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <p className="tnum truncate text-[26px] leading-8 font-semibold tracking-[-0.03em] text-ink">{value}</p>
        {delta != null ? (
          <span className={cn("inline-flex items-center gap-0.5 rounded px-1 text-[11.5px] font-medium", delta >= 0 ? "text-low" : "text-muted")}>
            {delta >= 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 truncate text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    // 1px gaps over a line-coloured background draw the dividers at every breakpoint.
    <section aria-label="Key metrics" className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-2 xl:grid-cols-4 [&>*]:bg-surface">
      {children}
    </section>
  );
}
