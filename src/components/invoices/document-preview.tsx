import { ExternalLink, FileText, FileX2 } from "lucide-react";
import { Card, CardHeader, cardLink } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import type { InvoiceRecord } from "@/lib/domain/models";
import { formatBytes } from "@/lib/utils";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function DocumentPreview({ invoice }: { invoice: InvoiceRecord }) {
  const src = `/api/invoices/${invoice.id}/document`;
  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={FileText}
        title="Original document"
        description={invoice.storagePath ? `${invoice.originalFileName} · ${formatBytes(invoice.fileSize)}` : undefined}
        action={
          invoice.storagePath ? (
            <a href={src} target="_blank" rel="noreferrer" className={cardLink}>
              Open <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : undefined
        }
      />
      {invoice.storagePath ? (
        <div className="border-t border-line bg-sunken p-3">
          {invoice.mimeType === "application/pdf" ? (
            <iframe title={`Preview of ${invoice.originalFileName}`} src={`${src}#view=FitH`} className="h-[600px] w-full rounded-md border border-line bg-surface" />
          ) : invoice.mimeType === DOCX_MIME ? (
            <>
              {/* Word files are converted to HTML on the server; the empty sandbox blocks scripts, forms and navigation. */}
              <iframe title={`Preview of ${invoice.originalFileName}`} src={`${src}?format=html`} sandbox="" className="h-[600px] w-full rounded-md border border-line bg-surface" />
              <p className="mt-2 text-xs text-muted">Simplified preview of a Word document. Layout may differ from the original; “Open” downloads the file.</p>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`Scan of ${invoice.originalFileName}`} src={src} className="mx-auto max-h-[600px] w-full rounded-md border border-line bg-surface object-contain" />
          )}
        </div>
      ) : (
        <EmptyState icon={FileX2} title="No document stored" description="This record was created from synthetic demo data, so there is no file to preview." />
      )}
    </Card>
  );
}
