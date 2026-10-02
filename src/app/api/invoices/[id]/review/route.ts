import { FieldValue } from "firebase-admin/firestore";
import { reviewActionToAudit } from "@/lib/domain/models";
import { NOTE_REQUIRED, nextReviewStatus, REVIEW_LABEL } from "@/lib/domain/scoring";
import type { ReviewStatus } from "@/lib/domain/types";
import { ApiError, handle, ok } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase-admin";
import { auditCol, invoices } from "@/lib/server/repo";
import { reviewSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(req);
  const { id } = await ctx.params;
  const { action, note } = reviewSchema.parse(await req.json());
  if (NOTE_REQUIRED.includes(action) && !note) throw new ApiError("validation_failed", "A note is required for this action.", 422);

  // Transaction: the transition check, status write and audit event are atomic.
  const result = await db().runTransaction(async (tx) => {
    const ref = invoices().doc(id);
    const snap = await tx.get(ref);
    const d = snap.data();
    if (!snap.exists || !d || d.ownerUid !== user.uid) throw new ApiError("not_found", "Invoice not found.", 404);
    const current = d.reviewStatus as ReviewStatus;
    const next = nextReviewStatus(current, action);
    if (!next) throw new ApiError("invalid_transition", `This invoice cannot be changed that way while it is “${REVIEW_LABEL[current]}”.`, 409);
    tx.update(ref, { reviewStatus: next, updatedAt: FieldValue.serverTimestamp() });
    tx.set(auditCol().doc(), {
      ownerUid: user.uid,
      actorUid: user.uid,
      actorName: user.name,
      invoiceId: id,
      invoiceLabel: d.invoiceNumber ?? d.originalFileName,
      action: reviewActionToAudit(action),
      previousValue: REVIEW_LABEL[current],
      newValue: REVIEW_LABEL[next],
      note: note ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
    return next;
  });
  return ok({ reviewStatus: result });
});
