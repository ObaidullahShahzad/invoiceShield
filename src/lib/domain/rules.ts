import { formatMoney, currencyExponent } from "./money";
import { daysBetween, median, normalizeInvoiceNumber, normalizeVendorName, similarity } from "./normalize";
import type { Finding, HistoryInvoice, InvoiceFields, RuleConfig, Vendor } from "./types";

export const RULES_VERSION = "2026.10.1";

export function defaultRuleConfig(currency: string | null | undefined): RuleConfig {
  return {
    arithmeticToleranceMinor: 10 ** currencyExponent(currency), // one major unit
    amountZThreshold: 3.5,
    minHistoryForOutlier: 4,
    nearDuplicateDays: 14,
  };
}

export interface RuleInput {
  /** The invoice under analysis. */
  invoice: InvoiceFields & { id: string; contentHash: string | null };
  vendors: Vendor[];
  /** Other invoices already stored for this owner (the invoice itself must be excluded). */
  history: HistoryInvoice[];
  config?: Partial<RuleConfig>;
}

export interface VendorMatch {
  vendor: Vendor | null;
  /** Exact normalized match, or a fuzzy suggestion that needs reviewer confirmation. */
  kind: "exact" | "suggested" | "none";
  score: number;
}

export function matchVendor(name: string | null, vendors: Vendor[]): VendorMatch {
  const n = normalizeVendorName(name);
  if (!n) return { vendor: null, kind: "none", score: 0 };
  let best: Vendor | null = null;
  let bestScore = 0;
  for (const v of vendors) {
    const vn = v.normalizedName || normalizeVendorName(v.name);
    if (vn === n) return { vendor: v, kind: "exact", score: 1 };
    const s = similarity(n, vn);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return bestScore >= 0.8 && best ? { vendor: best, kind: "suggested", score: bestScore } : { vendor: null, kind: "none", score: bestScore };
}

const mask = (last4: string | null | undefined) => (last4 ? `•••• ${last4}` : "—");

export function runRules(input: RuleInput): Finding[] {
  const { invoice, vendors, history } = input;
  const cfg: RuleConfig = { ...defaultRuleConfig(invoice.currency), ...input.config };
  const findings: Finding[] = [];
  const cur = invoice.currency;
  const money = (m: number | null | undefined) => formatMoney(m, cur);

  const num = normalizeInvoiceNumber(invoice.invoiceNumber);
  const match = matchVendor(invoice.vendorName, vendors);
  const normVendor = normalizeVendorName(invoice.vendorName);

  // --- Missing key fields ---------------------------------------------------
  const missing: string[] = [];
  if (!invoice.invoiceNumber) missing.push("invoice number");
  if (!invoice.invoiceDate) missing.push("invoice date");
  if (!invoice.vendorName) missing.push("vendor");
  if (invoice.totalMinor == null) missing.push("total");
  if (missing.length) {
    findings.push({
      ruleId: "FIELDS_MISSING",
      type: "missing_fields",
      severity: missing.length >= 2 ? "medium" : "low",
      title: "Key fields could not be extracted",
      description: `Missing: ${missing.join(", ")}. Other checks that depend on these values were skipped or are less reliable.`,
      evidence: { missing: missing.join(", ") },
    });
  }

  // --- Same file uploaded before -------------------------------------------
  if (invoice.contentHash) {
    const same = history.find((h) => h.contentHash === invoice.contentHash);
    if (same) {
      findings.push({
        ruleId: "DUP_FILE_HASH",
        type: "duplicate",
        severity: "high",
        title: "Identical file already uploaded",
        description: "The uploaded file is byte-for-byte identical to an earlier upload.",
        evidence: { matchingInvoice: same.invoiceNumber ?? same.id, uploadedAt: same.createdAt.slice(0, 10) },
        relatedInvoiceId: same.id,
      });
    }
  }

  // --- Duplicate checks -----------------------------------------------------
  const exactIds = new Set<string>();
  if (num && normVendor) {
    const matches = history
      .filter((h) => normalizeInvoiceNumber(h.invoiceNumber) === num && normalizeVendorName(h.vendorName) === normVendor)
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    matches.forEach((m) => exactIds.add(m.id));
    const h = matches[0];
    if (h) {
      const sameAmount = h.totalMinor != null && h.totalMinor === invoice.totalMinor;
      findings.push({
        ruleId: "DUP_EXACT",
        type: "duplicate",
        severity: "high",
        title: "Invoice number already recorded for this vendor",
        description: sameAmount
          ? "An earlier invoice has the same vendor, invoice number and total. Verify before any payment."
          : "An earlier invoice has the same vendor and invoice number but a different total or date. Verify which document is correct.",
        evidence: {
          vendor: invoice.vendorName,
          invoiceNumber: invoice.invoiceNumber,
          thisTotal: money(invoice.totalMinor),
          earlierTotal: money(h.totalMinor),
          thisDate: invoice.invoiceDate,
          earlierDate: h.invoiceDate,
          earlierRecords: matches.length,
        },
        relatedInvoiceId: h.id,
      });
    }
  }
  if (normVendor && invoice.totalMinor != null) {
    for (const h of history) {
      if (exactIds.has(h.id)) continue;
      if (normalizeVendorName(h.vendorName) !== normVendor || h.totalMinor !== invoice.totalMinor) continue;
      const hn = normalizeInvoiceNumber(h.invoiceNumber);
      const numSim = num && hn ? similarity(num, hn) : 0;
      const gap = invoice.invoiceDate && h.invoiceDate ? daysBetween(invoice.invoiceDate, h.invoiceDate) : null;
      const closeInTime = gap != null && gap <= cfg.nearDuplicateDays;
      if (numSim >= 0.75 || (closeInTime && numSim >= 0.5)) {
        findings.push({
          ruleId: "DUP_NEAR",
          type: "near_duplicate",
          severity: "medium",
          title: "Possible duplicate of an earlier invoice",
          description: "Same vendor and total with a similar invoice number or date. This is a possible match, not a confirmed duplicate.",
          evidence: {
            thisInvoiceNumber: invoice.invoiceNumber,
            earlierInvoiceNumber: h.invoiceNumber,
            total: money(invoice.totalMinor),
            daysApart: gap,
          },
          relatedInvoiceId: h.id,
        });
        break; // one near-duplicate finding is enough evidence
      }
    }
  }

  // --- Vendor ---------------------------------------------------------------
  const vendor = match.vendor;
  if (invoice.vendorName) {
    if (match.kind === "none") {
      findings.push({
        ruleId: "VENDOR_UNKNOWN",
        type: "vendor",
        severity: "medium",
        title: "Vendor not found in the vendor register",
        description: "No approved vendor matches this name. Confirm the vendor exists before payment review.",
        evidence: { extractedVendor: invoice.vendorName },
      });
    } else if (match.kind === "suggested" && vendor) {
      findings.push({
        ruleId: "VENDOR_UNKNOWN",
        type: "vendor",
        severity: "medium",
        title: "Vendor name resembles a registered vendor",
        description: `The name is not an exact match. It may be a spelling variant of "${vendor.name}", or an impersonation attempt. Reviewer confirmation required.`,
        evidence: { extractedVendor: invoice.vendorName, closestRegisteredVendor: vendor.name, similarity: Math.round(match.score * 100) + "%" },
      });
    } else if (vendor && !vendor.approved) {
      findings.push({
        ruleId: "VENDOR_UNAPPROVED",
        type: "vendor",
        severity: "medium",
        title: "Vendor is not approved",
        description: "The vendor exists in the register but is not marked approved.",
        evidence: { vendor: vendor.name },
      });
    }
  }

  // --- Payment account ------------------------------------------------------
  if (vendor && match.kind === "exact" && vendor.registeredBankAccountLast4 && invoice.paymentAccountLast4) {
    if (vendor.registeredBankAccountLast4 !== invoice.paymentAccountLast4) {
      findings.push({
        ruleId: "ACCOUNT_MISMATCH",
        type: "payment_account",
        severity: "high",
        title: "Payment account differs from the registered account",
        description: "The account on the invoice does not match the vendor's registered account. Verify the change with the vendor through a known contact channel.",
        evidence: { invoiceAccount: mask(invoice.paymentAccountLast4), registeredAccount: mask(vendor.registeredBankAccountLast4) },
      });
    }
  }

  // --- Unusual amount -------------------------------------------------------
  if (invoice.totalMinor != null) {
    const total = invoice.totalMinor;
    let flagged = false;
    if (vendor && match.kind === "exact" && vendor.typicalAmountMinMinor != null && vendor.typicalAmountMaxMinor != null) {
      if (total > vendor.typicalAmountMaxMinor || total < vendor.typicalAmountMinMinor) {
        flagged = true;
        findings.push({
          ruleId: "AMOUNT_UNUSUAL",
          type: "amount",
          severity: "medium",
          title: "Amount outside the vendor's typical range",
          description: "The total is outside the range configured for this vendor.",
          evidence: {
            total: money(total),
            typicalRange: `${money(vendor.typicalAmountMinMinor)} – ${money(vendor.typicalAmountMaxMinor)}`,
          },
        });
      }
    }
    if (!flagged && vendor) {
      const prior = history
        .filter((h) => h.vendorId === vendor.id && h.totalMinor != null && h.currency === invoice.currency)
        .map((h) => h.totalMinor as number);
      if (prior.length >= cfg.minHistoryForOutlier) {
        const med = median(prior);
        const mad = median(prior.map((v) => Math.abs(v - med)));
        const scale = mad > 0 ? 1.4826 * mad : Math.max(med * 0.05, 1);
        const z = (total - med) / scale;
        if (Math.abs(z) > cfg.amountZThreshold && Math.abs(total - med) > med * 0.25) {
          findings.push({
            ruleId: "AMOUNT_UNUSUAL",
            type: "amount",
            severity: "medium",
            title: "Amount is an outlier against vendor history",
            description: `The total is far from this vendor's usual invoices (${prior.length} prior invoices compared).`,
            evidence: { total: money(total), vendorMedian: money(Math.round(med)), robustZScore: Math.round(z * 10) / 10 },
          });
        }
      }
    }
  }

  // --- Arithmetic -----------------------------------------------------------
  if (invoice.subtotalMinor != null && invoice.taxMinor != null && invoice.totalMinor != null) {
    const expected = invoice.subtotalMinor + invoice.taxMinor;
    const diff = invoice.totalMinor - expected;
    if (Math.abs(diff) > cfg.arithmeticToleranceMinor) {
      findings.push({
        ruleId: "ARITH_MISMATCH",
        type: "arithmetic",
        severity: "medium",
        title: "Subtotal + tax does not equal total",
        description: "The stated total differs from subtotal plus tax by more than the configured tolerance.",
        evidence: {
          subtotal: money(invoice.subtotalMinor),
          tax: money(invoice.taxMinor),
          expectedTotal: money(expected),
          statedTotal: money(invoice.totalMinor),
          difference: money(diff),
        },
      });
    }
  }

  return findings;
}
