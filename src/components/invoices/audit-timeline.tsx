import { History } from "lucide-react";
import { AUDIT_ICON, AUDIT_TONE } from "@/components/dashboard/activity";
import { AUDIT_ACTION_LABEL, type AuditEventRecord } from "@/lib/domain/models";
import { cn, formatDateTime } from "@/lib/utils";

export function AuditTimeline({ events }: { events: AuditEventRecord[] }) {
  if (!events.length) return <p className="px-5 pb-5 text-[13px] text-muted">No events recorded.</p>;
  return (
    <ol className="px-5 pb-5">
      {events.map((e, idx) => {
        const Icon = AUDIT_ICON[e.action] ?? History;
        return (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {idx < events.length - 1 ? <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-line" /> : null}
            <span className={cn("relative grid size-[27px] shrink-0 place-items-center rounded-full border border-line bg-surface text-subtle", AUDIT_TONE[e.action])}>
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5 text-[13px] leading-5">
              <p className="font-medium">{AUDIT_ACTION_LABEL[e.action] ?? e.action}</p>
              <p className="text-xs text-subtle">
                {e.actorName} · <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
              </p>
              {e.previousValue && e.newValue && e.action.startsWith("review.") ? (
                <p className="mt-1 text-xs text-muted">
                  {e.previousValue} <span className="text-subtle">→</span> {e.newValue}
                </p>
              ) : e.newValue && e.action === "invoice.analyzed" ? (
                <p className="mt-1 text-xs text-muted">{e.newValue}</p>
              ) : null}
              {e.action === "invoice.fields_edited" && e.newValue ? <p className="mt-1 line-clamp-2 text-xs text-muted">{e.newValue}</p> : null}
              {e.note ? <p className="mt-2 border-l-2 border-line-strong pl-2.5 text-xs leading-relaxed text-ink-2">{e.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
