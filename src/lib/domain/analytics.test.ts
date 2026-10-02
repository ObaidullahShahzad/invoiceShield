import { describe, expect, it } from "vitest";
import { computeDashboard } from "./analytics";
import type { InvoiceRecord } from "./models";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-02T12:00:00Z");

const inv = (over: Partial<InvoiceRecord>): InvoiceRecord => ({
  id: Math.random().toString(36).slice(2), ownerUid: "u", storagePath: null, originalFileName: "x.pdf", mimeType: "application/pdf", fileSize: 1, contentHash: null,
  vendorId: null, vendorName: "Apex", invoiceNumber: "1", invoiceDate: "2026-09-30", currency: "PKR", subtotalMinor: 100, taxMinor: 17, totalMinor: 117, paymentAccountLast4: null,
  analysisStatus: "completed", analysisError: null, riskScore: 0, riskLevel: "low", reviewStatus: "needs_review", findingCount: 0, ruleIds: [], summary: null,
  verificationSteps: [], summarySource: null, extractionSource: "heuristic", uncertainFields: [], fieldsEdited: false,
  createdAt: new Date(NOW - DAY).toISOString(), updatedAt: new Date(NOW).toISOString(), analyzedAt: null, ...over,
});

describe("computeDashboard", () => {
  it("handles an empty workspace", () => {
    const d = computeDashboard([], NOW);
    expect(d.total).toEqual({ value: 0, delta: null });
    expect(d.weekly).toHaveLength(8);
    expect(d.flagRate).toBe(0);
  });
  it("aggregates open value, rule counts and week buckets", () => {
    const d = computeDashboard(
      [
        inv({ riskLevel: "high", reviewStatus: "flagged", findingCount: 2, ruleIds: ["DUP_EXACT", "ACCOUNT_MISMATCH"], totalMinor: 1000 }),
        inv({ riskLevel: "low", reviewStatus: "reviewed" }),
        inv({ riskLevel: "medium", reviewStatus: "needs_review", findingCount: 1, ruleIds: ["DUP_EXACT"], totalMinor: 500 }),
        inv({ analysisStatus: "extracting" }),
      ],
      NOW,
    );
    expect(d.flagged).toBe(1);
    expect(d.needsReview).toBe(1);
    expect(d.highRisk).toBe(1);
    expect(d.valueUnderReviewMinor).toBe(1500);
    expect(d.topRules[0]).toEqual({ rule: "Duplicate invoice no.", count: 2 });
    expect(d.weekly.reduce((s, w) => s + w.low + w.medium + w.high, 0)).toBe(3);
    expect(d.flagRate).toBe(67);
  });
  it("computes a 30-day delta", () => {
    const old = new Date(NOW - 40 * DAY).toISOString();
    const d = computeDashboard([inv({}), inv({}), inv({ createdAt: old })], NOW);
    expect(d.total.delta).toBe(100);
  });
});
