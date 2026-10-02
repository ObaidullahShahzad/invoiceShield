import type { Metadata } from "next";
import { VendorManager } from "@/components/vendors/vendor-manager";
import { Reveal } from "@/components/motion/reveal";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/server/auth";
import { listInvoices, listVendors } from "@/lib/server/repo";

export const metadata: Metadata = { title: "Vendors" };

export default async function VendorsPage() {
  const user = await requireUser();
  const [vendors, invoices] = await Promise.all([listVendors(user.uid), listInvoices(user.uid)]);
  const counts = new Map<string, number>();
  for (const i of invoices) if (i.vendorId) counts.set(i.vendorId, (counts.get(i.vendorId) ?? 0) + 1);
  return (
    <Reveal>
      <PageHeader title="Vendors" description="The register invoices are checked against. Bank accounts are shown masked." />
      <VendorManager vendors={vendors.map((v) => ({ ...v, invoiceCount: counts.get(v.id) ?? 0 }))} />
    </Reveal>
  );
}
