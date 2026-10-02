import { ApiError, handle, ok } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { getInvoice, listAudit, listFindings } from "@/lib/server/repo";

export const runtime = "nodejs";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(req);
  const { id } = await ctx.params;
  const invoice = await getInvoice(user.uid, id);
  if (!invoice) throw new ApiError("not_found", "Invoice not found.", 404);
  const [findings, audit] = await Promise.all([listFindings(id), listAudit(user.uid, { invoiceId: id })]);
  return ok({ invoice, findings, audit });
});
