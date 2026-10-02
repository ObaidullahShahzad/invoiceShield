import { FieldValue } from "firebase-admin/firestore";
import { normalizeVendorName } from "@/lib/domain/normalize";
import { ApiError, handle, ok } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { listVendors, vendorsCol, writeAudit } from "@/lib/server/repo";
import { vendorSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  return ok(await listVendors(user.uid));
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const v = vendorSchema.parse(await req.json());
  const normalizedName = normalizeVendorName(v.name);
  const existing = await listVendors(user.uid);
  if (existing.some((e) => e.normalizedName === normalizedName)) throw new ApiError("conflict", "A vendor with this name already exists.", 409);
  const ref = vendorsCol().doc();
  await ref.set({ ...v, ownerUid: user.uid, normalizedName, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await writeAudit({ ownerUid: user.uid, actorUid: user.uid, actorName: user.name, action: "vendor.created", newValue: v.name });
  return ok({ id: ref.id }, 201);
});
