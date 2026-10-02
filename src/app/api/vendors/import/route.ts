import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { parseVendorCsv, VENDOR_IMPORT_MAX_BYTES } from "@/lib/domain/vendor-import";
import { ApiError, handle, ok } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase-admin";
import { listVendors, vendorsCol, writeAudit } from "@/lib/server/repo";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({ csv: z.string().min(1).max(VENDOR_IMPORT_MAX_BYTES), updateExisting: z.boolean().default(false), fileName: z.string().max(200).optional() });

/** Bulk vendor import. The CSV is re-parsed and validated here; the browser preview is advisory only. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const { csv, updateExisting, fileName } = body.parse(await req.json());
  const parsed = parseVendorCsv(csv);
  if (parsed.fatal) throw new ApiError("validation_failed", parsed.fatal, 422);

  const existing = new Map((await listVendors(user.uid)).map((v) => [v.normalizedName, v]));
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let bankChanges = 0;

  let batch = db().batch();
  let ops = 0;
  const flush = async () => {
    if (ops) await batch.commit();
    batch = db().batch();
    ops = 0;
  };

  for (const r of parsed.rows) {
    const fields = {
      name: r.name,
      normalizedName: r.normalizedName,
      approved: r.approved,
      registeredBankAccountLast4: r.registeredBankAccountLast4,
      typicalAmountMinMinor: r.typicalAmountMinMinor,
      typicalAmountMaxMinor: r.typicalAmountMaxMinor,
      currency: r.currency,
      taxId: r.taxId,
      updatedAt: FieldValue.serverTimestamp(),
    };
    const match = existing.get(r.normalizedName);
    if (match) {
      if (!updateExisting) {
        skipped++;
        continue;
      }
      if (match.registeredBankAccountLast4 !== r.registeredBankAccountLast4) bankChanges++;
      batch.update(vendorsCol().doc(match.id), fields);
      updated++;
    } else {
      batch.set(vendorsCol().doc(), { ...fields, ownerUid: user.uid, createdAt: FieldValue.serverTimestamp() });
      created++;
    }
    if (++ops >= 400) await flush();
  }
  await flush();

  await writeAudit({
    ownerUid: user.uid,
    actorUid: user.uid,
    actorName: user.name,
    action: "vendor.imported",
    newValue: `${created} added, ${updated} updated, ${skipped} skipped, ${parsed.issues.length} rejected${fileName ? ` from ${fileName}` : ""}`,
    note: bankChanges ? `Registered bank account changed for ${bankChanges} vendor${bankChanges === 1 ? "" : "s"}` : null,
  });

  return ok({ created, updated, skipped, rejected: parsed.issues });
});
