import { ArrowLeft, Cpu, History, ListChecks, Sparkles, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/reveal";
import { AnalysisWatcher } from "@/components/invoices/analysis-watcher";
import { AuditTimeline } from "@/components/invoices/audit-timeline";
import { DocumentPreview } from "@/components/invoices/document-preview";
import { FieldsForm } from "@/components/invoices/fields-form";
import { FindingsList } from "@/components/invoices/findings-list";
import { ReviewActions } from "@/components/invoices/review-actions";
import { RiskGauge } from "@/components/invoices/risk-gauge";
import { RISK_DOT, RiskBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";
import { formatMoney } from "@/lib/domain/money";
import { RISK_LABEL } from "@/lib/domain/scoring";
import { requireUser } from "@/lib/server/auth";
import { getInvoice, listAudit, listFindings } from "@/lib/server/repo";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoice" };

const SOURCE: Record<string, string> = { ollama: "Local model", openrouter: "External model", template: "Rules template" };

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium text-subtle">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] text-ink">{children}</dd>
    </div>
  );
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const user = await requireUser();
  const invoice = await getInvoice(user.uid, invoiceId);
  if (!invoice) notFound();
  const [findings, audit] = await Promise.all([listFindings(invoiceId), listAudit(user.uid, { invoiceId })]);

  const running = ["uploaded", "extracting", "checking", "explaining"].includes(invoice.analysisStatus);
  const completed = invoice.analysisStatus === "completed";
  const title = invoice.invoiceNumber ?? invoice.originalFileName;

  return (
    <Reveal>
      <Link href="/invoices" className="mb-5 inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden /> Invoices
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-[22px] leading-8 font-semibold tracking-[-0.02em]">{title}</h1>
            {completed ? <RiskBadge level={invoice.riskLevel} score={invoice.riskScore} /> : null}
            <StatusBadge status={invoice.reviewStatus} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 sm:flex sm:flex-wrap">
            <Meta label="Vendor">{invoice.vendorName ?? <span className="text-subtle">Not extracted</span>}</Meta>
            <Meta label="Amount">
              <span className="tnum font-medium">{formatMoney(invoice.totalMinor, invoice.currency)}</span>
            </Meta>
            <Meta label="Invoice date">{formatDate(invoice.invoiceDate)}</Meta>
            <Meta label="Uploaded">{formatDate(invoice.createdAt)}</Meta>
          </dl>
        </div>
        <ReviewActions invoiceId={invoice.id} status={invoice.reviewStatus} disabled={!completed} />
      </div>

      {running ? <AnalysisWatcher invoiceId={invoice.id} initial={invoice.analysisStatus} /> : null}

      {invoice.analysisStatus === "failed" ? (
        <Notice tone="warning" icon={TriangleAlert} title="Automatic analysis could not finish" className="mb-5">
          {invoice.analysisError} Enter or correct the values in the panel and choose “Save and re-run checks”.
        </Notice>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {completed ? (
            <Card>
              <CardHeader
                title="Summary"
                description="Explains the findings below. It cannot add flags or change the score."
                action={
                  invoice.summarySource ? (
                    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line px-2 text-[11.5px] font-medium text-muted">
                      {invoice.summarySource === "template" ? <Sparkles className="size-3" aria-hidden /> : <Cpu className="size-3" aria-hidden />}
                      {SOURCE[invoice.summarySource]}
                    </span>
                  ) : undefined
                }
              />
              <div className="px-5 pb-5">
                <p className="text-[14px] leading-[1.7] text-ink-2">{invoice.summary}</p>
                {invoice.verificationSteps.length ? (
                  <div className="mt-4 rounded-lg border border-line bg-sunken/50 px-4 py-3.5">
                    <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
                      <ListChecks className="size-4 text-muted" aria-hidden /> Suggested verification
                    </p>
                    <ol className="mt-2.5 space-y-2 text-[13px] leading-relaxed text-ink-2">
                      {invoice.verificationSteps.map((s, i) => (
                        <li key={s} className="flex gap-2.5">
                          <span className="tnum mt-px grid size-[18px] shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-[10.5px] font-medium text-muted">{i + 1}</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <FindingsList findings={findings} analysed={completed} />
          <DocumentPreview invoice={invoice} />
        </div>

        <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          {completed ? (
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-[-0.01em]">Review risk score</h2>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
                  <span className={cn("size-1.5 rounded-full", RISK_DOT[invoice.riskLevel])} aria-hidden />
                  {RISK_LABEL[invoice.riskLevel]}
                </span>
              </div>
              <RiskGauge score={invoice.riskScore} level={invoice.riskLevel} />
              <p className="mt-4 border-t border-line pt-3 text-center text-[11.5px] leading-relaxed text-subtle">An indicator that anomalies need checking — not a fraud probability or a judgement about intent.</p>
            </Card>
          ) : null}
          <FieldsForm key={invoice.updatedAt} invoice={invoice} disabled={running} />
          <Card>
            <CardHeader icon={History} title="Activity" description="Append-only record of every action" />
            <AuditTimeline events={audit} />
          </Card>
        </div>
      </div>
    </Reveal>
  );
}
