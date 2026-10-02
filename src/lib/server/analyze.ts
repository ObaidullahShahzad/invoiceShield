import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { InvoiceRecord } from "@/lib/domain/models";
import { matchVendor, runRules, RULES_VERSION } from "@/lib/domain/rules";
import { scoreFindings } from "@/lib/domain/scoring";
import type { AnalysisStatus, InvoiceFields } from "@/lib/domain/types";
import { explainFindings, extractFields } from "./ai/ai";
import { db } from "./firebase-admin";
import { getInvoice, invoices, listInvoices, listVendors, toHistory, writeAudit } from "./repo";
import { getFile } from "./storage";
import { ExtractionError, textFromImage, textFromPdf } from "./text";

export interface Actor {
  uid: string;
  name: string;
}

const setStage = (id: string, analysisStatus: AnalysisStatus) =>
  invoices().doc(id).update({ analysisStatus, updatedAt: FieldValue.serverTimestamp() });

const fieldsOf = (i: InvoiceRecord): InvoiceFields => ({
  vendorName: i.vendorName,
  invoiceNumber: i.invoiceNumber,
  invoiceDate: i.invoiceDate,
  currency: i.currency,
  subtotalMinor: i.subtotalMinor,
  taxMinor: i.taxMinor,
  totalMinor: i.totalMinor,
  paymentAccountLast4: i.paymentAccountLast4,
});

/**
 * Analysis pipeline: extract → check → explain → persist.
 * `rules_only` re-uses the stored (possibly reviewer-corrected) fields and never re-runs extraction.
 * Never throws: failures are recorded on the invoice so the UI can show a recoverable state.
 */
export async function analyzeInvoice(opts: { ownerUid: string; actor: Actor; invoiceId: string; mode: "full" | "rules_only" }): Promise<void> {
  const { ownerUid, actor, invoiceId, mode } = opts;
  const started = Date.now();
  const invoice = await getInvoice(ownerUid, invoiceId);
  if (!invoice) return;
  const label = invoice.invoiceNumber ?? invoice.originalFileName;

  try {
    let fields = fieldsOf(invoice);
    let uncertain = invoice.uncertainFields;
    let extractionSource = invoice.extractionSource;

    if (mode === "full") {
      await setStage(invoiceId, "extracting");
      if (!invoice.storagePath) throw new ExtractionError("unreadable", "No document is stored for this invoice.");
      const file = await getFile(invoice.storagePath);
      const text = invoice.mimeType === "application/pdf" ? await textFromPdf(file) : await textFromImage(file);
      const out = await extractFields(text);
      fields = out.fields;
      uncertain = out.uncertainFields;
      extractionSource = out.source;
    }

    await setStage(invoiceId, "checking");
    const [vendors, all] = await Promise.all([listVendors(ownerUid), listInvoices(ownerUid)]);
    const history = all.filter((i) => i.id !== invoiceId && i.analysisStatus === "completed").map(toHistory);
    const match = matchVendor(fields.vendorName, vendors);
    const findings = runRules({ invoice: { ...fields, id: invoiceId, contentHash: invoice.contentHash }, vendors, history });
    const { score, level } = scoreFindings(findings);

    await setStage(invoiceId, "explaining");
    const explanation = await explainFindings(fields, findings);

    const batch = db().batch();
    const ref = invoices().doc(invoiceId);
    const old = await ref.collection("findings").get();
    old.docs.forEach((d) => batch.delete(d.ref));
    for (const f of findings) batch.set(ref.collection("findings").doc(), { ...f, createdAt: FieldValue.serverTimestamp() });
    batch.set(ref.collection("runs").doc(), {
      triggeredByUid: actor.uid,
      mode,
      rulesVersion: RULES_VERSION,
      extractionSource,
      summarySource: explanation.source,
      findingCount: findings.length,
      durationMs: Date.now() - started,
      status: "completed",
      completedAt: FieldValue.serverTimestamp(),
    });
    batch.update(ref, {
      ...fields,
      vendorId: match.kind === "exact" ? match.vendor?.id ?? null : null,
      uncertainFields: uncertain,
      extractionSource,
      riskScore: score,
      riskLevel: level,
      findingCount: findings.length,
      ruleIds: [...new Set(findings.map((f) => f.ruleId))],
      summary: explanation.summary,
      verificationSteps: explanation.verificationSteps,
      summarySource: explanation.source,
      analysisStatus: "completed",
      analysisError: null,
      reviewStatus: invoice.reviewStatus === "pending_analysis" ? "needs_review" : invoice.reviewStatus,
      analyzedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    await writeAudit({
      ownerUid,
      actorUid: actor.uid,
      actorName: actor.name,
      invoiceId,
      invoiceLabel: fields.invoiceNumber ?? label,
      action: "invoice.analyzed",
      newValue: `${level} risk (${score}), ${findings.length} finding${findings.length === 1 ? "" : "s"}`,
    });
  } catch (err) {
    const message =
      err instanceof ExtractionError ? err.message : "Analysis could not be completed. You can retry, or enter the values manually.";
    if (!(err instanceof ExtractionError)) console.error("[analyze] failed", invoiceId, err instanceof Error ? err.message : err);
    await invoices()
      .doc(invoiceId)
      .update({ analysisStatus: "failed", analysisError: message, updatedAt: FieldValue.serverTimestamp() })
      .catch(() => undefined);
    await writeAudit({ ownerUid, actorUid: actor.uid, actorName: actor.name, invoiceId, invoiceLabel: label, action: "invoice.analysis_failed", note: message }).catch(() => undefined);
  }
}
