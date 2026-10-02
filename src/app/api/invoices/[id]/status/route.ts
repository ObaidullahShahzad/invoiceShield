import { ApiError, handle, ok } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { getInvoice } from "@/lib/server/repo";

export const runtime = "nodejs";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(req);
  const { id } = await ctx.params;
  const i = await getInvoice(user.uid, id);
  if (!i) throw new ApiError("not_found", "Invoice not found.", 404);
  return ok({ analysisStatus: i.analysisStatus, analysisError: i.analysisError, reviewStatus: i.reviewStatus });
});
