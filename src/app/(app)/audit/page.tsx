import type { Metadata } from "next";
import { AuditLog } from "@/components/invoices/audit-log";
import { Reveal } from "@/components/motion/reveal";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/server/auth";
import { listAudit } from "@/lib/server/repo";

export const metadata: Metadata = { title: "Audit trail" };

export default async function AuditPage() {
  const user = await requireUser();
  const events = await listAudit(user.uid, { limit: 500 });
  return (
    <Reveal>
      <PageHeader title="Audit trail" description="A read-only, chronological record of analyses, corrections and review decisions." />
      <AuditLog events={events} />
    </Reveal>
  );
}
