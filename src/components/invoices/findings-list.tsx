import { ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { RISK_DOT, SeverityBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";
import type { FindingRecord } from "@/lib/domain/models";
import { cn } from "@/lib/utils";

const EVIDENCE_LABEL = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export function FindingsList({ findings, analysed }: { findings: FindingRecord[]; analysed: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Findings
            {analysed ? <span className="tnum rounded-md bg-neutral-bg px-1.5 text-xs font-medium text-muted">{findings.length}</span> : null}
          </span>
        }
        description={analysed ? "Raised by deterministic rules, each with its evidence" : "Waiting for analysis"}
      />
      {analysed && findings.length === 0 ? (
        <div className="px-5 pb-5">
          <Notice tone="success" icon={ShieldCheck} title="No rule raised a finding">
            This is still only an indicator — confirm against the purchase order before payment.
          </Notice>
        </div>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {findings.map((f) => (
            <li key={f.id} className="relative px-5 py-4">
              <span aria-hidden className={cn("absolute top-4 bottom-4 left-0 w-[3px] rounded-r-full", RISK_DOT[f.severity])} />
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                <SeverityBadge severity={f.severity} />
                <code className="ml-auto rounded bg-sunken px-1.5 py-0.5 font-mono text-[10.5px] text-subtle">{f.ruleId}</code>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{f.description}</p>
              {Object.keys(f.evidence).length ? (
                <dl className="mt-3 grid gap-px overflow-hidden rounded-lg border border-line bg-line text-[12.5px] sm:grid-cols-2">
                  {Object.entries(f.evidence).map(([k, v]) => (
                    <div key={k} className="flex min-w-0 items-baseline justify-between gap-3 bg-[#fafafb] px-3 py-2 sm:last:odd:col-span-2">
                      <dt className="shrink-0 text-subtle">{EVIDENCE_LABEL(k)}</dt>
                      <dd className="tnum truncate text-right font-mono text-[12px] font-medium text-ink">{v == null || v === "" ? "—" : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {f.relatedInvoiceId ? (
                <Link href={`/invoices/${f.relatedInvoiceId}`} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink underline decoration-line-strong underline-offset-[3px] transition-colors hover:decoration-ink">
                  Open the matching invoice <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
