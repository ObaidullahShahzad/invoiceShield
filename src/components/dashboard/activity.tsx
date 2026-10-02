import { ArrowRight, CircleCheck, FilePlus2, Flag, History, PencilLine, RotateCcw, ScanSearch, ShieldOff, TriangleAlert, UserCog, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, cardLink } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { AUDIT_ACTION_LABEL, type AuditEventRecord } from "@/lib/domain/models";
import { cn, timeAgo } from "@/lib/utils";

export const AUDIT_ICON: Record<string, LucideIcon> = {
  "invoice.uploaded": FilePlus2,
  "invoice.analyzed": ScanSearch,
  "invoice.analysis_failed": TriangleAlert,
  "invoice.fields_edited": PencilLine,
  "invoice.reanalyzed": RotateCcw,
  "review.mark_reviewed": CircleCheck,
  "review.flag": Flag,
  "review.clear": ShieldOff,
  "review.reopen": RotateCcw,
  "vendor.created": UserCog,
  "vendor.updated": UserCog,
};

/** Only events that warrant attention get colour on their icon. */
export const AUDIT_TONE: Record<string, string> = {
  "review.flag": "text-critical",
  "invoice.analysis_failed": "text-medium",
  "review.mark_reviewed": "text-low",
};

export function RecentActivity({ events }: { events: AuditEventRecord[] }) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Recent activity"
        description="Latest actions in your workspace"
        action={
          <Link href="/audit" className={cardLink}>
            Audit trail <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      {events.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" description="Uploads and reviewer decisions will be listed here." />
      ) : (
        <ol className="px-5 pb-5">
          {events.map((e, idx) => {
            const Icon = AUDIT_ICON[e.action] ?? History;
            const body = (
              <>
                <span className="font-medium text-ink">{AUDIT_ACTION_LABEL[e.action] ?? e.action}</span>
                {e.invoiceLabel ? <span className="ml-1.5 font-mono text-xs text-muted">{e.invoiceLabel}</span> : null}
              </>
            );
            return (
              <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                {idx < events.length - 1 ? <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-line" /> : null}
                <span className={cn("relative grid size-[27px] shrink-0 place-items-center rounded-full border border-line bg-surface text-subtle", AUDIT_TONE[e.action])}>
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 pt-0.5 text-[13px] leading-5">
                  <p className="truncate">{e.invoiceId ? <Link href={`/invoices/${e.invoiceId}`} className="hover:underline hover:decoration-line-strong hover:underline-offset-2">{body}</Link> : body}</p>
                  <p className="text-xs text-subtle">
                    {e.actorName} · {timeAgo(e.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
