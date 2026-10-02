"use client";
import { CircleAlert, CircleCheck, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { th } from "@/components/dashboard/review-queue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/misc";
import { formatMoney } from "@/lib/domain/money";
import { parseVendorCsv, VENDOR_IMPORT_MAX_BYTES, type VendorImportIssue } from "@/lib/domain/vendor-import";
import { cn, formatBytes } from "@/lib/utils";

interface Result {
  created: number;
  updated: number;
  skipped: number;
  rejected: VendorImportIssue[];
}

export function VendorImportDialog({ open, onOpenChange, existingNames }: { open: boolean; onOpenChange: (o: boolean) => void; existingNames: Set<string> }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number; text: string } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const parsed = useMemo(() => (file ? parseVendorCsv(file.text) : null), [file]);
  const fresh = parsed?.rows.filter((r) => !existingNames.has(r.normalizedName)) ?? [];
  const matching = parsed?.rows.filter((r) => existingNames.has(r.normalizedName)) ?? [];
  const toImport = fresh.length + (updateExisting ? matching.length : 0);

  function reset() {
    setFile(null);
    setReadError(null);
    setResult(null);
    setUpdateExisting(false);
    if (input.current) input.current.value = "";
  }

  async function pick(f: File | undefined | null) {
    if (!f) return;
    setResult(null);
    if (!/\.(csv|txt)$/i.test(f.name) && !["text/csv", "application/vnd.ms-excel", "text/plain"].includes(f.type)) {
      setFile(null);
      return setReadError("Choose a .csv file. In Excel or Google Sheets use File → Save as / Download → CSV.");
    }
    if (f.size > VENDOR_IMPORT_MAX_BYTES) {
      setFile(null);
      return setReadError(`This file is ${formatBytes(f.size)}. The limit is 1 MB.`);
    }
    setReadError(null);
    setFile({ name: f.name, size: f.size, text: await f.text() });
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const res = await fetch("/api/vendors/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv: file.text, updateExisting, fileName: file.name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "The import failed.");
      setResult(json.data);
      toast.success(`Imported vendors: ${json.data.created} added, ${json.data.updated} updated`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent title="Import vendors from CSV" description="Add or update many vendors at once. Nothing is saved until you confirm." className="max-w-2xl">
        {result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Added", result.created],
                ["Updated", result.updated],
                ["Skipped", result.skipped],
                ["Rejected", result.rejected.length],
              ].map(([label, n]) => (
                <div key={label} className="rounded-lg border border-line px-3 py-2.5">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="tnum text-xl font-semibold tracking-tight">{n}</p>
                </div>
              ))}
            </div>
            {result.skipped ? <p className="text-[13px] text-muted">Skipped vendors already exist. Re-import with “Update existing vendors” to overwrite them.</p> : null}
            <DialogFooter>
              <Button variant="secondary" onClick={reset}>
                <RotateCcw className="size-4" aria-hidden /> Import another file
              </Button>
              <DialogClose asChild>
                <Button variant="primary">Done</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                pick(e.dataTransfer.files[0]);
              }}
              className={cn("flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4 transition-colors", drag ? "border-ink bg-sunken" : "border-line-strong")}
            >
              <span className="grid size-9 place-items-center rounded-md border border-line bg-sunken text-muted">
                <FileSpreadsheet className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{file ? file.name : "Drop a CSV file here"}</p>
                <p className="text-xs text-muted">{file ? `${formatBytes(file.size)} · ${parsed?.totalLines ?? 0} rows` : "Up to 2,000 vendors, 1 MB"}</p>
              </div>
              <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
              <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
                <Upload className="size-3.5" aria-hidden /> {file ? "Choose another" : "Browse"}
              </Button>
            </div>

            <p className="text-xs leading-relaxed text-muted">
              Columns: <code className="font-mono">name</code> (required), <code className="font-mono">approved</code>, <code className="font-mono">bank_account</code>, <code className="font-mono">min_amount</code>,{" "}
              <code className="font-mono">max_amount</code>, <code className="font-mono">currency</code>, <code className="font-mono">tax_id</code>. Only the last 4 digits of a bank account are kept.{" "}
              <a href="/samples/vendor-import-template.csv" download className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-2">
                <Download className="size-3" aria-hidden /> Download template
              </a> ·{" "}
              <a href="/samples/vendor-demo-list.csv" download className="font-medium text-ink underline underline-offset-2">
                demo list (25 vendors)
              </a>
            </p>

            {readError ? (
              <Notice tone="error" icon={CircleAlert}>
                {readError}
              </Notice>
            ) : null}
            {parsed?.fatal ? (
              <Notice tone="error" icon={CircleAlert}>
                {parsed.fatal}
              </Notice>
            ) : null}

            {parsed && !parsed.fatal ? (
              <>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]" aria-live="polite">
                  <span className="inline-flex items-center gap-1.5">
                    <CircleCheck className="size-4 text-low" aria-hidden /> <b className="tnum">{fresh.length}</b> new
                  </span>
                  <span className="text-muted">
                    <b className="tnum text-ink">{matching.length}</b> already exist
                  </span>
                  <span className={cn(parsed.issues.length ? "text-critical" : "text-muted")}>
                    <b className="tnum">{parsed.issues.length}</b> with errors
                  </span>
                </div>

                {parsed.rows.length ? (
                  <div className="scroll-thin max-h-52 overflow-auto rounded-lg border border-line">
                    <table className="w-full text-left text-[12.5px]">
                      <thead className="sticky top-0 border-b border-line bg-sunken">
                        <tr>
                          <th className={`${th} pl-3`}>Vendor</th>
                          <th className={th}>Account</th>
                          <th className={th}>Typical amount</th>
                          <th className={`${th} pr-3`}>Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {parsed.rows.map((r) => {
                          const exists = existingNames.has(r.normalizedName);
                          return (
                            <tr key={r.line}>
                              <td className="py-1.5 pr-2 pl-3 font-medium">
                                {r.name}
                                {!r.approved ? <span className="ml-1.5 text-xs font-normal text-medium">not approved</span> : null}
                              </td>
                              <td className="px-2 py-1.5 font-mono text-muted">{r.registeredBankAccountLast4 ? `•••• ${r.registeredBankAccountLast4}` : "—"}</td>
                              <td className="tnum px-2 py-1.5 whitespace-nowrap text-muted">
                                {r.typicalAmountMinMinor != null || r.typicalAmountMaxMinor != null
                                  ? `${formatMoney(r.typicalAmountMinMinor, r.currency, { compact: true })} – ${formatMoney(r.typicalAmountMaxMinor, r.currency, { compact: true })}`
                                  : "—"}
                              </td>
                              <td className="py-1.5 pr-3 pl-2 text-xs">{exists ? (updateExisting ? <span className="text-ink">Update</span> : <span className="text-subtle">Skip</span>) : <span className="text-low">Add</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {parsed.issues.length ? (
                  <details className="rounded-lg border border-line" open={parsed.rows.length === 0}>
                    <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-critical">
                      {parsed.issues.length} row{parsed.issues.length === 1 ? "" : "s"} will not be imported
                    </summary>
                    <ul className="scroll-thin max-h-40 divide-y divide-line overflow-auto border-t border-line text-[12.5px]">
                      {parsed.issues.map((i) => (
                        <li key={i.line} className="px-3 py-1.5">
                          <span className="font-mono text-subtle">Line {i.line}</span>
                          {i.name ? <span className="ml-2 font-medium">{i.name}</span> : null}
                          <span className="ml-2 text-muted">{i.errors.join("; ")}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                {matching.length ? (
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 transition-colors hover:bg-sunken/50">
                    <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="mt-0.5 size-4 rounded border-line-strong accent-[#111113]" />
                    <span>
                      <span className="block text-[13px] font-medium">Update {matching.length} existing vendor{matching.length === 1 ? "" : "s"}</span>
                      <span className="block text-xs text-muted">Overwrites approval, bank account and amount range. Bank-account changes are recorded in the audit trail.</span>
                    </span>
                  </label>
                ) : null}
              </>
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button variant="primary" loading={busy} disabled={!parsed || !!parsed.fatal || toImport === 0} onClick={submit}>
                {toImport ? `Import ${toImport} vendor${toImport === 1 ? "" : "s"}` : "Import"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
