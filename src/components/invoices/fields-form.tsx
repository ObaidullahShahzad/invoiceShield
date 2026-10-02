"use client";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/inputs";
import { Notice } from "@/components/ui/misc";
import { toMajor, toMinor } from "@/lib/domain/money";
import type { InvoiceRecord } from "@/lib/domain/models";

type Draft = Record<"vendorName" | "invoiceNumber" | "invoiceDate" | "currency" | "subtotal" | "tax" | "total" | "paymentAccountLast4", string>;

function toDraft(i: InvoiceRecord): Draft {
  const major = (v: number | null) => (v == null ? "" : toMajor(v, i.currency).toFixed(2));
  return {
    vendorName: i.vendorName ?? "",
    invoiceNumber: i.invoiceNumber ?? "",
    invoiceDate: i.invoiceDate ?? "",
    currency: i.currency ?? "PKR",
    subtotal: major(i.subtotalMinor),
    tax: major(i.taxMinor),
    total: major(i.totalMinor),
    paymentAccountLast4: i.paymentAccountLast4 ?? "",
  };
}

const SOURCE_NOTE: Record<string, string> = {
  ai: "Read by the local model — verify against the document",
  heuristic: "Read by rules, no model used — verify against the document",
};

export function FieldsForm({ invoice, disabled }: { invoice: InvoiceRecord; disabled?: boolean }) {
  const router = useRouter();
  const initial = useMemo(() => toDraft(invoice), [invoice]);
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [busy, setBusy] = useState(false);
  const dirty = (Object.keys(d) as (keyof Draft)[]).some((k) => d[k] !== initial[k]);

  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    const cur = d.currency.trim().toUpperCase();
    if (cur && !/^[A-Z]{3}$/.test(cur)) errs.currency = "3-letter code";
    if (d.invoiceDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.invoiceDate)) errs.invoiceDate = "Use YYYY-MM-DD";
    if (d.paymentAccountLast4 && !/^\d{4}$/.test(d.paymentAccountLast4)) errs.paymentAccountLast4 = "Exactly 4 digits";
    const money = (k: "subtotal" | "tax" | "total") => {
      if (!d[k].trim()) return null;
      const n = Number(d[k].replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        errs[k] = "Enter a valid amount";
        return null;
      }
      return toMinor(n, cur || "PKR");
    };
    const subtotalMinor = money("subtotal");
    const taxMinor = money("tax");
    const totalMinor = money("total");
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const nul = (s: string) => (s.trim() ? s.trim() : null);
      const res = await fetch(`/api/invoices/${invoice.id}/fields`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendorName: nul(d.vendorName), invoiceNumber: nul(d.invoiceNumber), invoiceDate: nul(d.invoiceDate), currency: nul(cur),
          subtotalMinor, taxMinor, totalMinor, paymentAccountLast4: nul(d.paymentAccountLast4),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not save the changes.");
      toast.success(json.data.changed.length ? "Saved. Re-running checks…" : "No changes to save");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the changes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader divider title="Extracted fields" description={SOURCE_NOTE[invoice.extractionSource ?? ""] ?? "Enter or correct values, then re-run the checks"} />
      <form onSubmit={submit} className="space-y-3.5 p-5" noValidate>
        <Field label="Vendor">{(p) => <Input {...p} value={d.vendorName} onChange={set("vendorName")} disabled={disabled} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice number" error={errors.invoiceNumber}>
            {(p) => <Input {...p} value={d.invoiceNumber} onChange={set("invoiceNumber")} disabled={disabled} className="font-mono text-[12.5px]" />}
          </Field>
          <Field label="Invoice date" error={errors.invoiceDate}>
            {(p) => <Input {...p} type="date" value={d.invoiceDate} onChange={set("invoiceDate")} disabled={disabled} />}
          </Field>
        </div>
        <div className="grid grid-cols-[84px_1fr] gap-3">
          <Field label="Currency" error={errors.currency}>
            {(p) => <Input {...p} value={d.currency} onChange={set("currency")} disabled={disabled} maxLength={3} className="font-mono uppercase" />}
          </Field>
          <Field label="Payment account (last 4)" error={errors.paymentAccountLast4}>
            {(p) => <Input {...p} inputMode="numeric" value={d.paymentAccountLast4} onChange={set("paymentAccountLast4")} disabled={disabled} maxLength={4} className="font-mono" />}
          </Field>
        </div>

        <div className="space-y-2.5 rounded-lg border border-line bg-sunken/50 p-3">
          {(["subtotal", "tax", "total"] as const).map((k) => (
            <Field key={k} label={k === "tax" ? "Tax" : k[0].toUpperCase() + k.slice(1)} error={errors[k]}>
              {(p) => <Input {...p} inputMode="decimal" value={d[k]} onChange={set(k)} disabled={disabled} className={`tnum text-right font-mono text-[12.5px] ${k === "total" ? "font-semibold" : ""}`} />}
            </Field>
          ))}
        </div>

        {invoice.uncertainFields.length ? (
          <Notice tone="warning" icon={TriangleAlert} className="text-xs">
            Could not read reliably: {invoice.uncertainFields.map((f) => f.replace(/Minor$/, "").replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")}.
          </Notice>
        ) : null}
        <Button type="submit" variant="primary" className="w-full justify-center" loading={busy} disabled={!dirty || disabled}>
          {busy ? null : <RefreshCw className="size-4" aria-hidden />} Save and re-run checks
        </Button>
      </form>
    </Card>
  );
}
