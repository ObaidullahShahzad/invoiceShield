import { ArrowRight, Inbox } from "lucide-react";
import Link from "next/link";
import { RiskBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, cardLink } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { formatMoney } from "@/lib/domain/money";
import type { InvoiceRecord } from "@/lib/domain/models";
import { timeAgo } from "@/lib/utils";

export const th = "px-3 py-2 text-[11.5px] font-medium tracking-[0.02em] text-muted";

export function ReviewQueue({ items, total }: { items: InvoiceRecord[]; total: number }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Review queue"
        description={total ? `${total} invoice${total === 1 ? "" : "s"} waiting · highest risk first` : "Invoices waiting for a decision"}
        action={
          <Link href="/invoices?status=open" className={cardLink}>
            View all <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Inbox} title="Queue is clear" description="Nothing is waiting for review. New uploads that need attention appear here." />
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-y border-line bg-sunken/60">
              <tr>
                <th scope="col" className={`${th} pl-5`}>Invoice</th>
                <th scope="col" className={th}>Vendor</th>
                <th scope="col" className={`${th} text-right`}>Amount</th>
                <th scope="col" className={th}>Risk</th>
                <th scope="col" className={th}>Status</th>
                <th scope="col" className={`${th} pr-5 text-right`}>Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((i) => (
                <tr key={i.id} className="group relative transition-colors hover:bg-sunken/50">
                  <td className="py-3 pr-3 pl-5 whitespace-nowrap">
                    {/* The stretched link makes the whole row clickable while keeping one focus stop. */}
                    <Link href={`/invoices/${i.id}`} className="font-mono text-[12.5px] font-medium text-ink after:absolute after:inset-0">
                      {i.invoiceNumber ?? "—"}
                    </Link>
                  </td>
                  <td className="max-w-52 truncate px-3 py-3 text-ink-2">{i.vendorName ?? "—"}</td>
                  <td className="tnum px-3 py-3 text-right font-medium whitespace-nowrap">{formatMoney(i.totalMinor, i.currency)}</td>
                  <td className="px-3 py-3">
                    <RiskBadge level={i.riskLevel} score={i.riskScore} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={i.reviewStatus} />
                  </td>
                  <td className="py-3 pr-5 pl-3 text-right text-xs whitespace-nowrap text-subtle">{timeAgo(i.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
