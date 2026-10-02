import { ApiError, handle } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { getInvoice } from "@/lib/server/repo";
import { getFile } from "@/lib/server/storage";

export const runtime = "nodejs";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(req);
  const { id } = await ctx.params;
  const invoice = await getInvoice(user.uid, id);
  if (!invoice?.storagePath) throw new ApiError("not_found", "No document is stored for this invoice.", 404);
  const buf = await getFile(invoice.storagePath);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": invoice.mimeType,
      "content-disposition": `inline; filename="${encodeURIComponent(invoice.originalFileName)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
