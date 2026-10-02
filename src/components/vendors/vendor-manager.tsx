"use client";
import { BadgeCheck, Building2, CircleSlash, FileSpreadsheet, Pencil, Plus, Search, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { th } from "@/components/dashboard/review-queue";
import { Pill } from "@/components/ui/badge";
import { VendorImportDialog } from "@/components/vendors/vendor-import";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, fieldCls, Input } from "@/components/ui/inputs";
import { EmptyState } from "@/components/ui/misc";
import { formatMoney, toMajor, toMinor } from "@/lib/domain/money";
import type { VendorRecord } from "@/lib/domain/models";
import { cn } from "@/lib/utils";

interface Row extends VendorRecord {
  invoiceCount: number;
}

function VendorDialog({ vendor, open, onOpenChange }: { vendor: Row | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const cur = vendor?.currency ?? "PKR";
  const m = (v: number | null | undefined) => (v == null ? "" : String(toMajor(v, cur)));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const last4 = String(f.get("last4") ?? "").trim();
    const min = String(f.get("min") ?? "").trim();
    const max = String(f.get("max") ?? "").trim();
    const errs: Record<string, string> = {};
    if (name.length < 2) errs.name = "Enter the vendor’s legal name";
    if (last4 && !/^\d{4}$/.test(last4)) errs.last4 = "Exactly 4 digits";
    const minN = min ? Number(min) : null;
    const maxN = max ? Number(max) : null;
    if ((minN != null && (!Number.isFinite(minN) || minN < 0)) || (maxN != null && (!Number.isFinite(maxN) || maxN < 0))) errs.min = "Enter valid amounts";
    else if (minN != null && maxN != null && minN > maxN) errs.min = "Minimum is above maximum";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const body = {
        name,
        approved: f.get("approved") === "on",
        registeredBankAccountLast4: last4 || null,
        typicalAmountMinMinor: minN != null ? toMinor(minN, cur) : null,
        typicalAmountMaxMinor: maxN != null ? toMinor(maxN, cur) : null,
      };
      const res = await fetch(vendor ? `/api/vendors/${vendor.id}` : "/api/vendors", { method: vendor ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not save the vendor.");
      toast.success(vendor ? "Vendor updated" : "Vendor added");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setErrors({ name: err instanceof Error ? err.message : "Could not save the vendor." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={vendor ? "Edit vendor" : "Add vendor"} description="Vendor records power the unknown-vendor, bank-account and unusual-amount checks.">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Legal name" error={errors.name}>
            {(p) => <Input {...p} name="name" defaultValue={vendor?.name ?? ""} autoFocus />}
          </Field>
          <Field label="Registered bank account" error={errors.last4} hint="Last four digits only — the full number is never stored.">
            {(p) => (
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[12.5px] text-subtle">••••</span>
                <Input {...p} name="last4" inputMode="numeric" maxLength={4} defaultValue={vendor?.registeredBankAccountLast4 ?? ""} className="pl-12 font-mono" />
              </div>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Typical minimum (${cur})`} error={errors.min}>
              {(p) => <Input {...p} name="min" inputMode="decimal" defaultValue={m(vendor?.typicalAmountMinMinor)} className="tnum font-mono text-[12.5px]" />}
            </Field>
            <Field label={`Typical maximum (${cur})`}>{(p) => <Input {...p} name="max" inputMode="decimal" defaultValue={m(vendor?.typicalAmountMaxMinor)} className="tnum font-mono text-[12.5px]" />}</Field>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 transition-colors hover:bg-sunken/50">
            <input type="checkbox" name="approved" defaultChecked={vendor?.approved ?? true} className="mt-0.5 size-4 rounded border-line-strong accent-[#111113]" />
            <span>
              <span className="block text-[13px] font-medium">Approved vendor</span>
              <span className="block text-xs text-muted">Invoices from unapproved vendors raise a finding.</span>
            </span>
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={busy}>
              {vendor ? "Save changes" : "Add vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VendorManager({ vendors }: { vendors: Row[] }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const existingNames = useMemo(() => new Set(vendors.map((v) => v.normalizedName)), [vendors]);
  const rows = useMemo(() => vendors.filter((v) => v.name.toLowerCase().includes(q.trim().toLowerCase())), [vendors, q]);
  const approved = vendors.filter((v) => v.approved).length;

  const add = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} type="search" aria-label="Search vendors" placeholder="Search vendors" className={cn(fieldCls, "h-8 pl-8")} />
          </div>
          <p className="hidden px-2 text-[12.5px] text-muted sm:block">
            <span className="tnum font-medium text-ink">{approved}</span> of {vendors.length} approved
          </p>
          <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
            <FileSpreadsheet className="size-4" aria-hidden /> Import CSV
          </Button>
          <Button variant="primary" size="sm" onClick={add}>
            <Plus className="size-4" aria-hidden /> Add vendor
          </Button>
        </div>
        {vendors.length === 0 ? (
          <EmptyState icon={Building2} title="No vendors registered" description="Add the vendors you pay so unknown-vendor and bank-account checks can run." action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={() => setImporting(true)}>
                  <FileSpreadsheet className="size-4" aria-hidden /> Import CSV
                </Button>
                <Button variant="primary" onClick={add}>
                  Add vendor
                </Button>
              </div>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={SearchX} title="No vendors match your search" />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <caption className="sr-only">Vendor register</caption>
              <thead className="border-b border-line bg-sunken/60">
                <tr>
                  <th scope="col" className={`${th} pl-5`}>Vendor</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}>Registered account</th>
                  <th scope="col" className={th}>Typical amount</th>
                  <th scope="col" className={`${th} text-right`}>Invoices</th>
                  <th scope="col" className={`${th} pr-5`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((v) => (
                  <tr key={v.id} className="group transition-colors hover:bg-sunken/50">
                    <td className="py-2.5 pr-3 pl-5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-surface text-[11px] font-semibold text-muted">{v.name.slice(0, 1).toUpperCase()}</span>
                        <span className="font-medium text-ink">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {v.approved ? (
                        <Pill className="[&_svg]:text-low">
                          <BadgeCheck className="size-3.5" aria-hidden /> Approved
                        </Pill>
                      ) : (
                        <Pill className="text-medium">
                          <CircleSlash className="size-3.5" aria-hidden /> Not approved
                        </Pill>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12.5px] text-muted">{v.registeredBankAccountLast4 ? `•••• ${v.registeredBankAccountLast4}` : "—"}</td>
                    <td className="tnum px-3 py-2.5 whitespace-nowrap text-ink-2">
                      {v.typicalAmountMinMinor != null && v.typicalAmountMaxMinor != null ? (
                        <>
                          {formatMoney(v.typicalAmountMinMinor, v.currency, { compact: true })} <span className="text-subtle">–</span> {formatMoney(v.typicalAmountMaxMinor, v.currency, { compact: true })}
                        </>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="tnum px-3 py-2.5 text-right font-medium">{v.invoiceCount}</td>
                    <td className="py-2.5 pr-5 pl-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${v.name}`}
                        className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => {
                          setEditing(v);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" aria-hidden /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <VendorDialog key={editing?.id ?? "new"} vendor={editing} open={open} onOpenChange={setOpen} />
      <VendorImportDialog open={importing} onOpenChange={setImporting} existingNames={existingNames} />
    </>
  );
}
