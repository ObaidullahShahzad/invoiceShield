import { Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { Reveal } from "@/components/motion/reveal";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/server/auth";
import { listInvoices } from "@/lib/server/repo";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await requireUser();
  const [{ q, status }, invoices] = await Promise.all([searchParams, listInvoices(user.uid)]);
  return (
    <Reveal>
      <PageHeader
        title="Invoices"
        description="Search, filter and open any invoice to see the evidence behind its findings."
        actions={
          <Link href="/invoices/new" className={buttonClass("primary")}>
            <Upload className="size-4" aria-hidden /> Upload invoice
          </Link>
        }
      />
      <InvoiceTable invoices={invoices} initialQuery={q ?? ""} initialStatus={status ?? "all"} />
    </Reveal>
  );
}
