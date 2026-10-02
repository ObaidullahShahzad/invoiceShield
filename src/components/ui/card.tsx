import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  icon: Icon,
  divider,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  divider?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3.5", divider && "border-b border-line pb-4", className)}>
      <div className="flex min-w-0 gap-3">
        {Icon ? (
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted">
            <Icon className="size-3.5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm leading-6 font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {description ? <p className="text-[12.5px] leading-5 text-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Quiet text link used in card headers. */
export const cardLink = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-muted transition-colors hover:bg-hover hover:text-ink";
