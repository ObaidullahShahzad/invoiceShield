import { after } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { analyzeInvoice } from "@/lib/server/analyze";
import { ApiError, handle, ok } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { getInvoice, invoices, writeAudit } from "@/lib/server/repo";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(req);
  const { id } = await ctx.params;
  const invoice = await getInvoice(user.uid, id);
  if (!invoice) throw new ApiError("not_found", "Invoice not found.", 404);
  // A run killed by a platform timeout would otherwise stay "running" forever; treat it as stale after 3 minutes.
  const stale = Date.now() - Date.parse(invoice.updatedAt) > 3 * 60_000;
  if (["extracting", "checking", "explaining"].includes(invoice.analysisStatus) && !stale) {
    throw new ApiError("conflict", "An analysis is already running for this invoice.", 409);
  }
  // Re-extract only when nothing usable has been extracted yet; otherwise keep reviewer-corrected values.
  const mode = invoice.extractionSource === null && invoice.storagePath ? "full" : "rules_only";
  await invoices().doc(id).update({ analysisStatus: mode === "full" ? "extracting" : "checking", analysisError: null, updatedAt: FieldValue.serverTimestamp() });
  await writeAudit({ ownerUid: user.uid, actorUid: user.uid, actorName: user.name, invoiceId: id, invoiceLabel: invoice.invoiceNumber ?? invoice.originalFileName, action: "invoice.reanalyzed" });
  after(() => analyzeInvoice({ ownerUid: user.uid, actor: { uid: user.uid, name: user.name }, invoiceId: id, mode }));
  return ok({ status: "queued" }, 202);
});
