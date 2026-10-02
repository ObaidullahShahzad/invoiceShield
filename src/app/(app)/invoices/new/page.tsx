import type { Metadata } from "next";
import { UploadFlow } from "@/components/invoices/upload-flow";
import { Reveal } from "@/components/motion/reveal";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Upload invoice" };

export default function NewInvoicePage() {
  return (
    <Reveal>
      <PageHeader title="Upload invoice" description="We extract the fields, run deterministic checks and prepare a summary with the evidence." />
      <UploadFlow />
    </Reveal>
  );
}
