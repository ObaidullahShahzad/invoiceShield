import { CircleCheck, CircleDashed, Eye, Flag, LoaderCircle, ShieldOff, type LucideIcon } from "lucide-react";
import type { ReviewStatus, RiskLevel, Severity } from "@/lib/domain/types";
import { REVIEW_LABEL, RISK_LABEL, SEVERITY_LABEL } from "@/lib/domain/scoring";
import { cn } from "@/lib/utils";

const base = "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium whitespace-nowrap";

/** Dot colours carry the meaning; the badge itself stays neutral except at critical. */
export const RISK_DOT: Record<RiskLevel, string> = {
  low: "bg-low",
  medium: "bg-medium",
  high: "bg-high",
  critical: "bg-critical",
};

const RISK_SHELL: Record<RiskLevel, string> = {
  low: "border-line bg-surface text-ink-2",
  medium: "border-line bg-surface text-ink-2",
  high: "border-line bg-surface text-ink-2",
  critical: "border-critical/20 bg-critical-bg text-critical",
};

/** Severity is always communicated with colour, a label and (where given) a score — never colour alone. */
export function RiskBadge({ level, score, className }: { level: RiskLevel; score?: number; className?: string }) {
  return (
    <span className={cn(base, RISK_SHELL[level], className)}>
      <span className={cn("size-1.5 rounded-full", RISK_DOT[level])} aria-hidden />
      {RISK_LABEL[level]}
      {score != null ? (
        <>
          <span className="h-3 w-px bg-current opacity-20" aria-hidden />
          <span className="tnum font-mono text-[11px] opacity-75">{score}</span>
        </>
      ) : null}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const level: RiskLevel = severity;
  return (
    <span className={cn(base, RISK_SHELL[level])}>
      <span className={cn("size-1.5 rounded-full", RISK_DOT[level])} aria-hidden />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const STATUS: Record<ReviewStatus, { cls: string; icon: LucideIcon; spin?: boolean }> = {
  pending_analysis: { cls: "text-muted", icon: LoaderCircle, spin: true },
  needs_review: { cls: "text-ink-2", icon: Eye },
  in_review: { cls: "text-ink-2", icon: CircleDashed },
  reviewed: { cls: "text-ink-2 [&_svg]:text-low", icon: CircleCheck },
  flagged: { cls: "text-critical", icon: Flag },
  cleared: { cls: "text-muted", icon: ShieldOff },
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const { cls, icon: Icon, spin } = STATUS[status];
  return (
    <span className={cn(base, "border-transparent bg-neutral-bg", cls)}>
      <Icon className={cn("size-3.5 opacity-80", spin && "animate-spin")} aria-hidden />
      {REVIEW_LABEL[status]}
    </span>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(base, "border-transparent bg-neutral-bg text-ink-2", className)}>{children}</span>;
}
