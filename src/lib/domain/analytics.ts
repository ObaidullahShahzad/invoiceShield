import type { InvoiceRecord } from "./models";
import type { ReviewStatus, RiskLevel, RuleId } from "./types";

export const RULE_LABEL: Record<RuleId, string> = {
  DUP_FILE_HASH: "Identical file",
  DUP_EXACT: "Duplicate invoice no.",
  DUP_NEAR: "Possible duplicate",
  VENDOR_UNKNOWN: "Unknown / look-alike vendor",
  VENDOR_UNAPPROVED: "Unapproved vendor",
  ACCOUNT_MISMATCH: "Bank account mismatch",
  AMOUNT_UNUSUAL: "Unusual amount",
  ARITH_MISMATCH: "Arithmetic mismatch",
  FIELDS_MISSING: "Missing key fields",
};

export interface Kpi {
  value: number;
  /** Change versus the previous 30 days, in percent. null when there is no baseline. */
  delta: number | null;
}

export interface DashboardData {
  total: Kpi;
  needsReview: number;
  flagged: number;
  highRisk: number;
  valueUnderReviewMinor: number;
  currency: string;
  flagRate: number; // 0..100
  weekly: { label: string; low: number; medium: number; high: number }[];
  risk: { level: RiskLevel; count: number }[];
  topRules: { rule: string; count: number }[];
  status: { status: ReviewStatus; count: number }[];
  vendorExposure: { vendor: string; valueMinor: number; invoices: number }[];
}

const OPEN: ReviewStatus[] = ["needs_review", "in_review", "flagged"];
const DAY = 86_400_000;

function weekStart(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return d.getTime() - dow * DAY;
}

export function computeDashboard(all: InvoiceRecord[], now = Date.now()): DashboardData {
  const done = all.filter((i) => i.analysisStatus === "completed");
  const t = (i: InvoiceRecord) => new Date(i.createdAt).getTime();
  const last30 = all.filter((i) => now - t(i) <= 30 * DAY).length;
  const prev30 = all.filter((i) => now - t(i) > 30 * DAY && now - t(i) <= 60 * DAY).length;

  const open = done.filter((i) => OPEN.includes(i.reviewStatus));
  const currency = done.find((i) => i.currency)?.currency ?? "PKR";

  const weeks = 8;
  const thisWeek = weekStart(now);
  const weekly = Array.from({ length: weeks }, (_, k) => {
    const start = thisWeek - (weeks - 1 - k) * 7 * DAY;
    const label = new Date(start).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
    return { start, label, low: 0, medium: 0, high: 0 };
  });
  for (const i of done) {
    const w = weekly.find((b) => t(i) >= b.start && t(i) < b.start + 7 * DAY);
    if (!w) continue;
    if (i.riskLevel === "low") w.low++;
    else if (i.riskLevel === "medium") w.medium++;
    else w.high++;
  }

  const levels: RiskLevel[] = ["low", "medium", "high", "critical"];
  const ruleCounts = new Map<RuleId, number>();
  for (const i of done) for (const r of i.ruleIds) ruleCounts.set(r, (ruleCounts.get(r) ?? 0) + 1);

  const statuses: ReviewStatus[] = ["needs_review", "in_review", "flagged", "reviewed", "cleared"];

  const byVendor = new Map<string, { valueMinor: number; invoices: number }>();
  for (const i of open) {
    if (!i.vendorName || i.totalMinor == null) continue;
    const cur = byVendor.get(i.vendorName) ?? { valueMinor: 0, invoices: 0 };
    cur.valueMinor += i.totalMinor;
    cur.invoices++;
    byVendor.set(i.vendorName, cur);
  }

  return {
    total: { value: all.length, delta: prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : null },
    needsReview: done.filter((i) => i.reviewStatus === "needs_review" || i.reviewStatus === "in_review").length,
    flagged: done.filter((i) => i.reviewStatus === "flagged").length,
    highRisk: open.filter((i) => i.riskLevel === "high" || i.riskLevel === "critical").length,
    valueUnderReviewMinor: open.reduce((s, i) => s + (i.totalMinor ?? 0), 0),
    currency,
    flagRate: done.length ? Math.round((done.filter((i) => i.findingCount > 0).length / done.length) * 100) : 0,
    weekly: weekly.map(({ label, low, medium, high }) => ({ label, low, medium, high })),
    risk: levels.map((level) => ({ level, count: done.filter((i) => i.riskLevel === level).length })),
    topRules: [...ruleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([r, count]) => ({ rule: RULE_LABEL[r], count })),
    status: statuses.map((status) => ({ status, count: done.filter((i) => i.reviewStatus === status).length })),
    vendorExposure: [...byVendor.entries()]
      .sort((a, b) => b[1].valueMinor - a[1].valueMinor)
      .slice(0, 5)
      .map(([vendor, v]) => ({ vendor, ...v })),
  };
}
