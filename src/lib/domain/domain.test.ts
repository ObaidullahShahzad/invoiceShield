import { describe, expect, it } from "vitest";
import { heuristicExtract, parseDate } from "./extract";
import { formatMoney, parseAmount, toMinor } from "./money";
import { normalizeInvoiceNumber, normalizeVendorName } from "./normalize";
import { runRules } from "./rules";
import { nextReviewStatus, scoreFindings } from "./scoring";
import type { HistoryInvoice, Vendor } from "./types";

const vendor: Vendor = {
  id: "v1",
  name: "Apex Supplies Ltd.",
  normalizedName: normalizeVendorName("Apex Supplies Ltd."),
  approved: true,
  registeredBankAccountLast4: "4421",
  typicalAmountMinMinor: 10_000_00,
  typicalAmountMaxMinor: 800_000_00,
};

const base = {
  id: "new",
  contentHash: "hash-new",
  vendorName: "Apex Supplies Limited",
  invoiceNumber: "INV-2026-1042",
  invoiceDate: "2026-09-25",
  currency: "PKR",
  subtotalMinor: 420_000_00,
  taxMinor: 65_000_00,
  totalMinor: 485_000_00,
  paymentAccountLast4: "4421",
};

const prior = (over: Partial<HistoryInvoice>): HistoryInvoice => ({
  ...base,
  id: "old",
  vendorId: "v1",
  contentHash: "hash-old",
  createdAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

describe("money", () => {
  it("round-trips minor units without float drift", () => {
    expect(toMinor(0.1 + 0.2, "PKR")).toBe(30);
    expect(toMinor(1500, "JPY")).toBe(1500);
  });
  it("parses locale variants", () => {
    expect(parseAmount("PKR 485,000.00")).toBe(485000);
    expect(parseAmount("1.234,50")).toBe(1234.5);
    expect(parseAmount("12,50")).toBe(12.5);
    expect(parseAmount("1,234")).toBe(1234);
  });
  it("formats PKR", () => expect(formatMoney(485_000_00, "PKR")).toContain("485,000"));
});

describe("normalization", () => {
  it("folds vendor suffixes and punctuation", () => {
    expect(normalizeVendorName("Apex Supplies Ltd.")).toBe(normalizeVendorName("APEX SUPPLIES LIMITED"));
    expect(normalizeVendorName("Crescent Logistics (Pvt) Ltd")).toBe("crescent logistics");
  });
  it("canonicalizes invoice numbers", () => expect(normalizeInvoiceNumber("inv 2026/1042")).toBe("INV20261042"));
});

describe("rules", () => {
  it("flags an exact duplicate with a reference to the match", () => {
    const f = runRules({ invoice: base, vendors: [vendor], history: [prior({})] });
    const dup = f.find((x) => x.ruleId === "DUP_EXACT");
    expect(dup?.severity).toBe("high");
    expect(dup?.relatedInvoiceId).toBe("old");
  });
  it("reports several earlier matches as a single finding", () => {
    const f = runRules({ invoice: base, vendors: [vendor], history: [prior({ id: "a" }), prior({ id: "b", createdAt: "2026-09-10T00:00:00.000Z" })] });
    const dups = f.filter((x) => x.ruleId === "DUP_EXACT");
    expect(dups).toHaveLength(1);
    expect(dups[0].relatedInvoiceId).toBe("b");
    expect(dups[0].evidence.earlierRecords).toBe(2);
  });
  it("labels near duplicates as possible matches", () => {
    const f = runRules({ invoice: base, vendors: [vendor], history: [prior({ invoiceNumber: "INV-2026-1043", invoiceDate: "2026-09-24" })] });
    expect(f.some((x) => x.ruleId === "DUP_EXACT")).toBe(false);
    expect(f.find((x) => x.ruleId === "DUP_NEAR")?.title).toMatch(/Possible/);
  });
  it("detects identical file hashes", () => {
    const f = runRules({ invoice: { ...base, contentHash: "same" }, vendors: [vendor], history: [prior({ contentHash: "same", invoiceNumber: "X-1" })] });
    expect(f.some((x) => x.ruleId === "DUP_FILE_HASH")).toBe(true);
  });
  it("flags arithmetic mismatch beyond tolerance only", () => {
    const off = runRules({ invoice: { ...base, totalMinor: 495_000_00 }, vendors: [vendor], history: [] });
    expect(off.some((x) => x.ruleId === "ARITH_MISMATCH")).toBe(true);
    const rounding = runRules({ invoice: { ...base, totalMinor: 485_000_50 }, vendors: [vendor], history: [] });
    expect(rounding.some((x) => x.ruleId === "ARITH_MISMATCH")).toBe(false);
  });
  it("flags unknown vendors and fuzzy look-alikes differently", () => {
    const unknown = runRules({ invoice: { ...base, vendorName: "Zenith Traders" }, vendors: [vendor], history: [] });
    expect(unknown.find((x) => x.ruleId === "VENDOR_UNKNOWN")?.title).toMatch(/not found/);
    const lookalike = runRules({ invoice: { ...base, vendorName: "Apex Suplies Ltd" }, vendors: [vendor], history: [] });
    expect(lookalike.find((x) => x.ruleId === "VENDOR_UNKNOWN")?.title).toMatch(/resembles/);
  });
  it("flags payment account mismatch and masks values", () => {
    const f = runRules({ invoice: { ...base, paymentAccountLast4: "9999" }, vendors: [vendor], history: [] });
    const m = f.find((x) => x.ruleId === "ACCOUNT_MISMATCH");
    expect(m?.severity).toBe("high");
    expect(JSON.stringify(m?.evidence)).toContain("•••• 9999");
  });
  it("flags amounts outside the vendor range", () => {
    const f = runRules({ invoice: { ...base, subtotalMinor: 2_000_000_00, taxMinor: 0, totalMinor: 2_000_000_00 }, vendors: [vendor], history: [] });
    expect(f.some((x) => x.ruleId === "AMOUNT_UNUSUAL")).toBe(true);
  });
  it("reports clean invoices with no findings", () => {
    expect(runRules({ invoice: base, vendors: [vendor], history: [] })).toEqual([]);
  });
  it("reports missing fields", () => {
    const f = runRules({ invoice: { ...base, invoiceNumber: null, totalMinor: null }, vendors: [vendor], history: [] });
    expect(f.find((x) => x.ruleId === "FIELDS_MISSING")?.severity).toBe("medium");
  });
});

describe("scoring and workflow", () => {
  it("sums fixed points, caps at 100 and maps levels", () => {
    expect(scoreFindings([{ severity: "high" }])).toEqual({ score: 40, level: "high" });
    expect(scoreFindings([{ severity: "medium" }])).toEqual({ score: 18, level: "medium" });
    expect(scoreFindings([{ severity: "low" }])).toEqual({ score: 6, level: "low" });
    expect(scoreFindings([{ severity: "high" }, { severity: "high" }])).toEqual({ score: 80, level: "critical" });
    expect(scoreFindings([{ severity: "high" }, { severity: "high" }, { severity: "high" }])).toEqual({ score: 100, level: "critical" });
    expect(scoreFindings([])).toEqual({ score: 0, level: "low" });
  });
  it("enforces review transitions", () => {
    expect(nextReviewStatus("needs_review", "flag")).toBe("flagged");
    expect(nextReviewStatus("flagged", "clear")).toBe("cleared");
    expect(nextReviewStatus("needs_review", "clear")).toBeNull();
    expect(nextReviewStatus("pending_analysis", "mark_reviewed")).toBeNull();
  });
});

describe("heuristic extraction", () => {
  const text = `Apex Supplies Ltd.
TAX INVOICE
Invoice No: INV-2026-1042
Invoice Date: 25 Sep 2026
Subtotal: PKR 420,000.00
GST (17%): PKR 65,000.00
Total Due: PKR 485,000.00
Bank Account: PK36 SCBL 0000 0011 2345 4421`;
  it("extracts the key fields", () => {
    const { fields } = heuristicExtract(text);
    expect(fields).toMatchObject({
      vendorName: "Apex Supplies Ltd.",
      invoiceNumber: "INV-2026-1042",
      invoiceDate: "2026-09-25",
      currency: "PKR",
      subtotalMinor: 420_000_00,
      taxMinor: 65_000_00,
      totalMinor: 485_000_00,
      paymentAccountLast4: "4421",
    });
  });
  it("parses dates", () => {
    expect(parseDate("25/09/2026")).toBe("2026-09-25");
    expect(parseDate("September 5, 2026")).toBe("2026-09-05");
    expect(parseDate("2026-13-40")).toBeNull();
  });
});
