import { ApiError, handle } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { getInvoice } from "@/lib/server/repo";
import { getFile } from "@/lib/server/storage";
import { DOCX_MIME, docxToHtml } from "@/lib/server/text";

export const runtime = "nodejs";

const PREVIEW_STYLE = `body{font:14px/1.55 -apple-system,system-ui,sans-serif;color:#16213a;margin:0;padding:28px 32px;background:#fff}
table{border-collapse:collapse;margin:12px 0;width:100%}td,th{border:1px solid #e1e6ed;padding:6px 8px;text-align:left;vertical-align:top}
img{max-width:100%;height:auto}p{margin:0 0 8px}h1,h2,h3{margin:16px 0 8px;line-height:1.25}a{color:#176b87}`;

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(req);
  const { id } = await ctx.params;
  const invoice = await getInvoice(user.uid, id);
  if (!invoice?.storagePath) throw new ApiError("not_found", "No document is stored for this invoice.", 404);
  const buf = await getFile(invoice.storagePath);
  const filename = encodeURIComponent(invoice.originalFileName);

  if (invoice.mimeType === DOCX_MIME) {
    // Browsers cannot display Word files, so ?format=html renders a read-only HTML version for the preview frame.
    if (new URL(req.url).searchParams.get("format") === "html") {
      const html = await docxToHtml(buf).catch(() => "<p>This document could not be previewed. Download it to view the original.</p>");
      return new Response(`<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_STYLE}</style></head><body>${html}</body></html>`, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
          // No scripts, no network: only inline styles and embedded images, inside a sandboxed frame.
          "content-security-policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
        },
      });
    }
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": DOCX_MIME,
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": invoice.mimeType,
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
