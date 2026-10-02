import { FieldValue } from "firebase-admin/firestore";
import { normalizeVendorName } from "@/lib/domain/normalize";
import { ApiError, handle, ok } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { getVendor, vendorsCol, writeAudit } from "@/lib/server/repo";
import { vendorSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(req);
  const { id } = await ctx.params;
  const current = await getVendor(user.uid, id);
  if (!current) throw new ApiError("not_found", "Vendor not found.", 404);
  const patch = vendorSchema.partial().parse(await req.json());
  const update = { ...patch, ...(patch.name ? { normalizedName: normalizeVendorName(patch.name) } : {}), updatedAt: FieldValue.serverTimestamp() };
  await vendorsCol().doc(id).update(update);
  const bankChanged = patch.registeredBankAccountLast4 !== undefined && patch.registeredBankAccountLast4 !== current.registeredBankAccountLast4;
  await writeAudit({
    ownerUid: user.uid,
    actorUid: user.uid,
    actorName: user.name,
    action: "vendor.updated",
    newValue: current.name,
    note: bankChanged ? "Registered bank account changed" : null,
  });
  return ok({ id });
});
