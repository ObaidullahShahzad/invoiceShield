import { after } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { analyzeInvoice } from "@/lib/server/analyze";
import { ApiError, handle, ok } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { getInvoice, invoices, writeAudit } from "@/lib/server/repo";
import { fieldsPatchSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(req);
  const { id } = await ctx.params;
  const invoice = await getInvoice(user.uid, id);
  if (!invoice) throw new ApiError("not_found", "Invoice not found.", 404);
  const patch = fieldsPatchSchema.parse(await req.json());

  const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => patch[k] !== undefined && patch[k] !== invoice[k]);
  if (changed.length === 0) return ok({ changed: [] });

  await invoices()
    .doc(id)
    .update({
      ...Object.fromEntries(changed.map((k) => [k, patch[k]])),
      uncertainFields: invoice.uncertainFields.filter((f) => !(changed as string[]).includes(f)),
      fieldsEdited: true,
      extractionSource: invoice.extractionSource ?? "manual",
      analysisStatus: "checking",
      analysisError: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  await writeAudit({
    ownerUid: user.uid,
    actorUid: user.uid,
    actorName: user.name,
    invoiceId: id,
    invoiceLabel: invoice.invoiceNumber ?? invoice.originalFileName,
    action: "invoice.fields_edited",
    previousValue: changed.map((k) => `${k}: ${invoice[k] ?? "—"}`).join("; "),
    newValue: changed.map((k) => `${k}: ${patch[k] ?? "—"}`).join("; "),
  });
  after(() => analyzeInvoice({ ownerUid: user.uid, actor: { uid: user.uid, name: user.name }, invoiceId: id, mode: "rules_only" }));
  return ok({ changed }, 202);
});
