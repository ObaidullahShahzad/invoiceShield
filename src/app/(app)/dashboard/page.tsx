import { Banknote, FileText, Hourglass, OctagonAlert, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RecentActivity } from "@/components/dashboard/activity";
import { RiskDonut, RulesBar, VendorBar, WeeklyChart } from "@/components/dashboard/charts";
import { KpiCard, KpiStrip } from "@/components/dashboard/kpi";
import { ReviewQueue } from "@/components/dashboard/review-queue";
import { SeedButton } from "@/components/dashboard/seed-button";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Reveal } from "@/components/motion/reveal";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { computeDashboard } from "@/lib/domain/analytics";
import { requireUser } from "@/lib/server/auth";
import { listAudit, listInvoices, listVendors } from "@/lib/server/repo";

export const metadata: Metadata = { title: "Overview" };

const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export default async function DashboardPage() {
  const user = await requireUser();
  const [invoices, vendors, audit] = await Promise.all([listInvoices(user.uid), listVendors(user.uid), listAudit(user.uid, { limit: 7 })]);
  const firstName = user.name.split(/\s+/)[0];

  const uploadAction = (
    <Link href="/invoices/new" className={buttonClass("primary")}>
      <Upload className="size-4" aria-hidden /> Upload invoice
    </Link>
  );

  if (invoices.length === 0) {
    return (
      <Reveal>
        <PageHeader eyebrow={today.format(new Date())} title={`Welcome, ${firstName}`} description="Upload an invoice to see extraction, checks and evidence in action." actions={uploadAction} />
        <Card>
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description={
              vendors.length
                ? "Upload your first invoice. Your vendor register is ready, so vendor and bank-detail checks will run."
                : "Upload your first invoice, or load a synthetic vendor register and invoice history so duplicate and anomaly checks have something to compare against."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {uploadAction}
                {vendors.length === 0 ? <SeedButton /> : null}
              </div>
            }
          />
        </Card>
      </Reveal>
    );
  }

  const d = computeDashboard(invoices);
  const queue = invoices
    .filter((i) => i.analysisStatus === "completed" && ["needs_review", "in_review", "flagged"].includes(i.reviewStatus))
    .sort((a, b) => b.riskScore - a.riskScore || b.createdAt.localeCompare(a.createdAt));

  return (
    <Reveal className="space-y-5" stagger={0.07}>
      <PageHeader eyebrow={today.format(new Date())} title={`Good to see you, ${firstName}`} description="What needs attention, and why." actions={uploadAction} />

      <KpiStrip>
        <KpiCard label="Invoices" icon={FileText} value={<AnimatedNumber value={d.total.value} />} delta={d.total.delta} hint="vs previous 30 days" />
        <KpiCard label="Awaiting review" icon={Hourglass} value={<AnimatedNumber value={d.needsReview} />} hint={`${d.flagRate}% of analysed raised a finding`} />
        <KpiCard label="High-risk open" icon={OctagonAlert} emphasis={d.highRisk > 0} value={<AnimatedNumber value={d.highRisk} />} hint={`${d.flagged} flagged for investigation`} />
        <KpiCard
          label="Value under review"
          icon={Banknote}
          value={<AnimatedNumber value={d.valueUnderReviewMinor} format={{ kind: "money", currency: d.currency, compact: true }} />}
          hint="Open and flagged invoices"
        />
      </KpiStrip>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Analysis volume" description="Invoices analysed per week, by review risk" />
          <div className="px-5 pb-5">
            <WeeklyChart data={d.weekly} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Risk mix" description="Distribution of review risk levels" />
          <div className="px-5 pb-5">
            <RiskDonut data={d.risk} />
          </div>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <ReviewQueue items={queue.slice(0, 6)} total={queue.length} />
        </div>
        <RecentActivity events={audit} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Most frequent findings" description="Invoices by triggered rule" />
          <div className="px-5 pt-1 pb-5">
            <RulesBar data={d.topRules} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Value awaiting review" description={`Top vendors by open value · ${d.currency}`} />
          <div className="px-5 pt-1 pb-5">
            <VendorBar data={d.vendorExposure} currency={d.currency} />
          </div>
        </Card>
      </section>
    </Reveal>
  );
}
