import type { AnalysisStatus, Finding, InvoiceFields, ReviewAction, ReviewStatus, RiskLevel, RuleId, Vendor } from "./types";

export type SummarySource = "ollama" | "openrouter" | "template";
export type ExtractionSource = "ai" | "heuristic" | "manual";

/** Invoice as sent to the UI (all timestamps are ISO strings). */
export interface InvoiceRecord extends InvoiceFields {
  id: string;
  ownerUid: string;
  storagePath: string | null;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  contentHash: string | null;
  vendorId: string | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  riskScore: number;
  riskLevel: RiskLevel;
  reviewStatus: ReviewStatus;
  findingCount: number;
  ruleIds: RuleId[];
  summary: string | null;
  verificationSteps: string[];
  summarySource: SummarySource | null;
  extractionSource: ExtractionSource | null;
  uncertainFields: string[];
  fieldsEdited: boolean;
  createdAt: string;
  updatedAt: string;
  analyzedAt: string | null;
}

export interface FindingRecord extends Finding {
  id: string;
  createdAt: string;
}

export interface AuditEventRecord {
  id: string;
  ownerUid: string;
  actorUid: string;
  actorName: string;
  invoiceId: string | null;
  invoiceLabel: string | null;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  note: string | null;
  createdAt: string;
}

export type VendorRecord = Vendor & { ownerUid: string; createdAt: string; updatedAt: string };

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "invoice.uploaded": "Uploaded invoice",
  "invoice.analyzed": "Analysis completed",
  "invoice.analysis_failed": "Analysis failed",
  "invoice.fields_edited": "Corrected extracted fields",
  "invoice.reanalyzed": "Re-ran analysis",
  "review.mark_reviewed": "Marked as reviewed",
  "review.flag": "Flagged for investigation",
  "review.clear": "Cleared flag",
  "review.reopen": "Reopened for review",
  "vendor.created": "Added vendor",
  "vendor.updated": "Updated vendor",
  "demo.seeded": "Loaded demo data",
};

export const reviewActionToAudit = (a: ReviewAction) => `review.${a}`;
