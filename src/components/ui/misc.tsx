import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-neutral-bg", className)} />;
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="relative mb-5">
        <div className="bg-dots absolute -inset-6 rounded-full [mask-image:radial-gradient(closest-side,black,transparent)]" aria-hidden />
        <div className="relative grid size-11 place-items-center rounded-xl border border-line bg-surface text-ink-2 shadow-card">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </div>
      </div>
      <h3 className="text-sm font-semibold tracking-[-0.01em]">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5 text-xs font-medium text-muted">{eyebrow}</div> : null}
        <h1 className="text-[22px] leading-8 font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[13.5px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Inline notice for warnings and errors. Neutral shell, coloured icon. */
export function Notice({ tone = "warning", icon: Icon, title, children, className }: { tone?: "warning" | "error" | "info" | "success"; icon: LucideIcon; title?: ReactNode; children?: ReactNode; className?: string }) {
  const tones = {
    warning: "border-medium/20 bg-medium-bg [&_.notice-icon]:text-medium",
    error: "border-critical/20 bg-critical-bg [&_.notice-icon]:text-critical",
    info: "border-line bg-sunken [&_.notice-icon]:text-muted",
    success: "border-low/20 bg-low-bg [&_.notice-icon]:text-low",
  };
  return (
    <div role={tone === "error" ? "alert" : undefined} className={cn("flex gap-3 rounded-lg border px-3.5 py-3 text-[13px] text-ink-2", tones[tone], className)}>
      <Icon className="notice-icon mt-px size-4 shrink-0" aria-hidden />
      <div className="min-w-0 leading-relaxed">
        {title ? <p className="font-medium text-ink">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-5 items-center rounded border border-line bg-surface px-1.5 font-sans text-[10.5px] font-medium text-subtle shadow-card", className)}>{children}</kbd>;
}
