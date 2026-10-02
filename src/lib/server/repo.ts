import "server-only";
import { FieldValue, Timestamp, type DocumentData, type DocumentSnapshot } from "firebase-admin/firestore";
import type { AuditEventRecord, FindingRecord, InvoiceRecord, VendorRecord } from "@/lib/domain/models";
import { normalizeVendorName } from "@/lib/domain/normalize";
import type { HistoryInvoice } from "@/lib/domain/types";
import { db } from "./firebase-admin";

const iso = (v: unknown): string => (v instanceof Timestamp ? v.toDate().toISOString() : typeof v === "string" ? v : new Date(0).toISOString());
const isoOrNull = (v: unknown): string | null => (v ? iso(v) : null);

export function mapInvoice(s: DocumentSnapshot): InvoiceRecord {
  const d = s.data() as DocumentData;
  return {
    id: s.id,
    ownerUid: d.ownerUid,
    storagePath: d.storagePath ?? null,
    originalFileName: d.originalFileName ?? "",
    mimeType: d.mimeType ?? "",
    fileSize: d.fileSize ?? 0,
    contentHash: d.contentHash ?? null,
    vendorId: d.vendorId ?? null,
    vendorName: d.vendorName ?? null,
    invoiceNumber: d.invoiceNumber ?? null,
    invoiceDate: d.invoiceDate ?? null,
    currency: d.currency ?? null,
    subtotalMinor: d.subtotalMinor ?? null,
    taxMinor: d.taxMinor ?? null,
    totalMinor: d.totalMinor ?? null,
    paymentAccountLast4: d.paymentAccountLast4 ?? null,
    analysisStatus: d.analysisStatus ?? "uploaded",
    analysisError: d.analysisError ?? null,
    riskScore: d.riskScore ?? 0,
    riskLevel: d.riskLevel ?? "low",
    reviewStatus: d.reviewStatus ?? "pending_analysis",
    findingCount: d.findingCount ?? 0,
    ruleIds: d.ruleIds ?? [],
    summary: d.summary ?? null,
    verificationSteps: d.verificationSteps ?? [],
    summarySource: d.summarySource ?? null,
    extractionSource: d.extractionSource ?? null,
    uncertainFields: d.uncertainFields ?? [],
    fieldsEdited: Boolean(d.fieldsEdited),
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
    analyzedAt: isoOrNull(d.analyzedAt),
  };
}

export const invoices = () => db().collection("invoices");
export const vendorsCol = () => db().collection("vendors");
export const auditCol = () => db().collection("auditEvents");

export async function listInvoices(uid: string, limit = 1000): Promise<InvoiceRecord[]> {
  const snap = await invoices().where("ownerUid", "==", uid).limit(limit).get();
  return snap.docs.map(mapInvoice).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Returns null both when the invoice is missing and when it belongs to someone else. */
export async function getInvoice(uid: string, id: string): Promise<InvoiceRecord | null> {
  const s = await invoices().doc(id).get();
  if (!s.exists || s.data()?.ownerUid !== uid) return null;
  return mapInvoice(s);
}

export async function listFindings(invoiceId: string): Promise<FindingRecord[]> {
  const snap = await invoices().doc(invoiceId).collection("findings").get();
  const order = { high: 0, medium: 1, low: 2 } as const;
  return snap.docs
    .map((s) => ({ id: s.id, ...(s.data() as Omit<FindingRecord, "id" | "createdAt">), createdAt: iso(s.data().createdAt) }))
    .sort((a, b) => order[a.severity] - order[b.severity]);
}

export function mapAudit(s: DocumentSnapshot): AuditEventRecord {
  const d = s.data() as DocumentData;
  return {
    id: s.id,
    ownerUid: d.ownerUid,
    actorUid: d.actorUid,
    actorName: d.actorName ?? "Unknown",
    invoiceId: d.invoiceId ?? null,
    invoiceLabel: d.invoiceLabel ?? null,
    action: d.action,
    previousValue: d.previousValue ?? null,
    newValue: d.newValue ?? null,
    note: d.note ?? null,
    createdAt: iso(d.createdAt),
  };
}

export async function listAudit(uid: string, opts: { invoiceId?: string; limit?: number } = {}): Promise<AuditEventRecord[]> {
  let q = auditCol().where("ownerUid", "==", uid);
  if (opts.invoiceId) q = q.where("invoiceId", "==", opts.invoiceId);
  // No orderBy here (it would need a composite index), so fetch a bounded window, sort, then apply the caller's limit.
  const snap = await q.limit(2000).get();
  return snap.docs
    .map(mapAudit)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, opts.limit ?? 500);
}

export interface AuditInput {
  ownerUid: string;
  actorUid: string;
  actorName: string;
  invoiceId?: string | null;
  invoiceLabel?: string | null;
  action: string;
  previousValue?: string | null;
  newValue?: string | null;
  note?: string | null;
  createdAt?: Date;
}

/** Audit events are append-only: the app only ever creates them. */
export async function writeAudit(e: AuditInput): Promise<void> {
  await auditCol().add({
    ...e,
    invoiceId: e.invoiceId ?? null,
    invoiceLabel: e.invoiceLabel ?? null,
    createdAt: e.createdAt ? Timestamp.fromDate(e.createdAt) : FieldValue.serverTimestamp(),
  });
}

export function mapVendor(s: DocumentSnapshot): VendorRecord {
  const d = s.data() as DocumentData;
  return {
    id: s.id,
    ownerUid: d.ownerUid,
    name: d.name,
    normalizedName: d.normalizedName ?? normalizeVendorName(d.name),
    taxId: d.taxId ?? null,
    approved: Boolean(d.approved),
    registeredBankAccountLast4: d.registeredBankAccountLast4 ?? null,
    typicalAmountMinMinor: d.typicalAmountMinMinor ?? null,
    typicalAmountMaxMinor: d.typicalAmountMaxMinor ?? null,
    currency: d.currency ?? "PKR",
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

export async function listVendors(uid: string): Promise<VendorRecord[]> {
  const snap = await vendorsCol().where("ownerUid", "==", uid).get();
  return snap.docs.map(mapVendor).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getVendor(uid: string, id: string): Promise<VendorRecord | null> {
  const s = await vendorsCol().doc(id).get();
  return s.exists && s.data()?.ownerUid === uid ? mapVendor(s) : null;
}

export function toHistory(i: InvoiceRecord): HistoryInvoice {
  return {
    id: i.id,
    vendorId: i.vendorId,
    contentHash: i.contentHash,
    createdAt: i.createdAt,
    vendorName: i.vendorName,
    invoiceNumber: i.invoiceNumber,
    invoiceDate: i.invoiceDate,
    currency: i.currency,
    subtotalMinor: i.subtotalMinor,
    taxMinor: i.taxMinor,
    totalMinor: i.totalMinor,
    paymentAccountLast4: i.paymentAccountLast4,
  };
}

export async function upsertUser(u: { uid: string; email: string; name: string }) {
  const ref = db().collection("users").doc(u.uid);
  const s = await ref.get();
  if (!s.exists) await ref.set({ displayName: u.name, email: u.email, role: "reviewer", createdAt: FieldValue.serverTimestamp() });
}
