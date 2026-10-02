"use client";
import { Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function SeedButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not load demo data.");
      toast.success(`Loaded ${json.data.vendors} vendors and ${json.data.invoices} synthetic invoices`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load demo data.");
      setBusy(false);
    }
  }
  return (
    <Button variant="secondary" onClick={run} loading={busy}>
      {busy ? null : <Database className="size-4 text-muted" aria-hidden />} Load synthetic demo data
    </Button>
  );
}
