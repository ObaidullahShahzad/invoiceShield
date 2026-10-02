export type Severity = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type AnalysisStatus = "uploaded" | "extracting" | "checking" | "explaining" | "completed" | "failed";

export type ReviewStatus = "pending_analysis" | "needs_review" | "in_review" | "reviewed" | "flagged" | "cleared";

export type ReviewAction = "mark_reviewed" | "flag" | "clear" | "reopen";

export type FindingType =
  | "duplicate"
  | "near_duplicate"
  | "vendor"
  | "payment_account"
  | "amount"
  | "arithmetic"
  | "missing_fields";

export type RuleId =
  | "DUP_FILE_HASH"
  | "DUP_EXACT"
  | "DUP_NEAR"
  | "VENDOR_UNKNOWN"
  | "VENDOR_UNAPPROVED"
  | "ACCOUNT_MISMATCH"
  | "AMOUNT_UNUSUAL"
  | "ARITH_MISMATCH"
  | "FIELDS_MISSING";

export type EvidenceValue = string | number | null;

export interface Finding {
  ruleId: RuleId;
  type: FindingType;
  severity: Severity;
  title: string;
  description: string;
  evidence: Record<string, EvidenceValue>;
  relatedInvoiceId?: string;
}

/** Normalized invoice fields. Money values are integer minor units. */
export interface InvoiceFields {
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null; // YYYY-MM-DD
  currency: string | null;
  subtotalMinor: number | null;
  taxMinor: number | null;
  totalMinor: number | null;
  paymentAccountLast4: string | null;
}

export const FIELD_KEYS = [
  "vendorName",
  "invoiceNumber",
  "invoiceDate",
  "currency",
  "subtotalMinor",
  "taxMinor",
  "totalMinor",
  "paymentAccountLast4",
] as const satisfies readonly (keyof InvoiceFields)[];

export type FieldKey = (typeof FIELD_KEYS)[number];

export interface Vendor {
  id: string;
  name: string;
  normalizedName: string;
  taxId?: string | null;
  approved: boolean;
  registeredBankAccountLast4?: string | null;
  typicalAmountMinMinor?: number | null;
  typicalAmountMaxMinor?: number | null;
  currency?: string | null;
}

/** The slice of a stored invoice needed for history comparison. */
export interface HistoryInvoice extends InvoiceFields {
  id: string;
  vendorId: string | null;
  contentHash: string | null;
  createdAt: string;
}

export interface RuleConfig {
  /** Arithmetic tolerance in minor units. */
  arithmeticToleranceMinor: number;
  /** Robust z-score above which an amount is considered unusual. */
  amountZThreshold: number;
  /** Minimum prior invoices from a vendor before history-based outlier detection applies. */
  minHistoryForOutlier: number;
  /** Day window for near-duplicate comparison. */
  nearDuplicateDays: number;
}
