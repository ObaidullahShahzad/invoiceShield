"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowRight, CircleAlert, CloudUpload, FileText, FlaskConical, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisStages } from "@/components/invoices/analysis-stages";
import { ScanVisual } from "@/components/loader/brand-loader";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";
import { cn, formatBytes } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const MAX_MB = 4;
const ACCEPT = ["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

const SAMPLES = [
  { file: "01-legitimate-apex-supplies.pdf", title: "Legitimate invoice", note: "Matches vendor register — expect low risk" },
  { file: "02-duplicate-crescent-logistics.pdf", title: "Duplicate invoice number", note: "Same vendor and number as an earlier invoice" },
  { file: "03-account-and-amount-meridian.pdf", title: "Bank account and amount", note: "Different bank account, amount above usual range" },
  { file: "04-lookalike-and-arithmetic.pdf", title: "Look-alike vendor", note: "Name resembles a vendor; total does not add up" },
  { file: "05-replayed-invoice-summit.pdf", title: "Replayed invoice, new bank", note: "Old invoice number, changed bank details, inflated amount" },
  { file: "06-word-invoice-summit.docx", title: "Word document (DOCX)", note: "Same checks on a .docx file — expect low risk" },
];

type Phase = "idle" | "uploading" | "analyzing" | "failed";
const STAGES = [
  { key: "uploading", label: "Uploading", hint: "Sending the file securely" },
  { key: "extracting", label: "Extracting fields", hint: "Reading vendor, amounts and bank details" },
  { key: "checking", label: "Running checks", hint: "Comparing against history and the vendor register" },
  { key: "explaining", label: "Preparing summary", hint: "Writing a plain-language explanation" },
] as const;

export function UploadFlow() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const zone = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState<string>("uploading");
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  // Subtle lift of the drop-zone icon while a file is dragged over it.
  useGSAP(
    () => {
      gsap.to("[data-drop-icon]", { y: drag ? -4 : 0, scale: drag ? 1.06 : 1, duration: 0.35, ease: "power3.out" });
    },
    { scope: zone, dependencies: [drag] },
  );

  const validate = (f: File): string | null => {
    if (!ACCEPT.includes(f.type) && !/\.(pdf|png|jpe?g|docx)$/i.test(f.name)) return /\.doc$/i.test(f.name) ? "Legacy .doc files are not supported. Save it as .docx or PDF and try again." : "Unsupported file type. Choose a PDF, PNG, JPEG or DOCX.";
    if (f.size > MAX_MB * 1024 * 1024) return `This file is ${formatBytes(f.size)}. The limit is ${MAX_MB} MB.`;
    if (f.size === 0) return "This file is empty.";
    return null;
  };

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    const err = validate(f);
    setError(err);
    setFile(err ? null : f);
  };

  const start = useCallback(async (f: File) => {
    setPhase("uploading");
    setStage("uploading");
    setError(null);
    abort.current = new AbortController();
    try {
      const body = new FormData();
      body.append("file", f);
      const res = await fetch("/api/invoices", { method: "POST", body, signal: abort.current.signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Upload failed.");
      setInvoiceId(json.data.invoiceId);
      setPhase("analyzing");
      setStage("extracting");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
      setPhase("failed");
    }
  }, []);

  // Poll the real analysis status — stages shown are what the server reports, not a fake progress bar.
  useEffect(() => {
    if (phase !== "analyzing" || !invoiceId) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/status`, { cache: "no-store" });
        const json = await res.json();
        if (stop || !res.ok) return;
        const s = json.data.analysisStatus as string;
        // A failed extraction is recoverable: the detail page lets the reviewer enter values and re-run.
        if (s === "completed" || s === "failed") {
          router.push(`/invoices/${invoiceId}`);
          return;
        }
        if (s !== "uploaded") setStage(s);
      } catch {
        /* transient; keep polling */
      }
      if (!stop) setTimeout(tick, 900);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [phase, invoiceId, router]);

  async function trySample(name: string) {
    try {
      const res = await fetch(`/samples/${name}`);
      const blob = await res.blob();
      const f = new File([blob], name, { type: name.endsWith(".docx") ? ACCEPT[3] : "application/pdf" });
      setFile(f);
      setError(null);
      start(f);
    } catch {
      setError("Could not load the sample file.");
    }
  }

  const busy = phase === "uploading" || phase === "analyzing";
  const activeIdx = STAGES.findIndex((s) => s.key === stage);

  if (busy) {
    return (
      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[1fr_1.1fr]">
          <ScanVisual className="min-h-72 border-b border-line bg-sunken/60 md:border-r md:border-b-0" />
          <div role="status" aria-live="polite" className="p-6 sm:p-8">
            <p className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">Analysing</p>
            <h2 className="mt-1 flex items-center gap-2 truncate text-base font-semibold tracking-[-0.01em]">
              <FileText className="size-4 shrink-0 text-muted" aria-hidden />
              <span className="truncate">{file?.name}</span>
            </h2>
            <div className="mt-6">
              <AnalysisStages stages={STAGES} active={activeIdx} />
            </div>
            <p className="mt-6 text-xs leading-relaxed text-muted">Scanned images use OCR and can take up to a minute. You can leave this page — the result will appear in Invoices.</p>
            <Button
              className="mt-4"
              variant="secondary"
              size="sm"
              onClick={() => {
                abort.current?.abort();
                router.push("/invoices");
              }}
            >
              <X className="size-3.5" aria-hidden /> {phase === "uploading" ? "Cancel upload" : "Continue in background"}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div
          ref={zone}
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
          className={cn(
            "group relative overflow-hidden rounded-card border border-dashed bg-surface px-8 py-14 text-center transition-colors sm:py-20",
            drag ? "border-ink/40 bg-sunken" : "border-line-strong hover:border-[#c5c5cd]",
            error && "border-critical/40",
          )}
        >
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]" aria-hidden />
          <div className="relative">
            <div data-drop-icon className="mx-auto mb-5 grid size-12 place-items-center rounded-xl border border-line bg-surface text-ink-2 shadow-card">
              <CloudUpload className="size-5" strokeWidth={1.75} aria-hidden />
            </div>
            <p className="text-[15px] font-semibold tracking-[-0.01em]">{drag ? "Release to upload" : "Drop an invoice here"}</p>
            <p className="mt-1 text-[13px] text-muted">PDF, PNG, JPEG or DOCX · up to {MAX_MB} MB</p>
            <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" id="file" onChange={(e) => pick(e.target.files?.[0])} />
            <Button className="mt-6" onClick={() => input.current?.click()}>
              Browse files
            </Button>
          </div>
        </div>

        {error ? (
          <Notice tone="error" icon={CircleAlert}>
            <span className="flex flex-wrap items-center gap-x-3">
              {error}
              {phase === "failed" && file ? (
                <button onClick={() => start(file)} className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-2">
                  <RotateCcw className="size-3.5" aria-hidden /> Retry
                </button>
              ) : null}
            </span>
          </Notice>
        ) : null}

        {file && !error ? (
          <Card className="flex items-center gap-3 p-3">
            <span className="grid size-10 place-items-center rounded-lg border border-line bg-sunken text-muted">
              <FileText className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{file.name}</p>
              <p className="text-xs text-subtle">{formatBytes(file.size)}</p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Remove file" onClick={() => setFile(null)}>
              <X className="size-4" aria-hidden />
            </Button>
            <Button variant="primary" onClick={() => start(file)}>
              Analyse invoice <ArrowRight className="size-4" aria-hidden />
            </Button>
          </Card>
        ) : null}
      </div>

      <aside>
        <Card className="overflow-hidden">
          <CardHeader icon={FlaskConical} title="Synthetic samples" description="Fictional invoices that exercise each check. Load the demo data on the overview first for best results." />
          <ul className="divide-y divide-line border-t border-line">
            {SAMPLES.map((s, i) => (
              <li key={s.file}>
                <button onClick={() => trySample(s.file)} className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-sunken/60">
                  <span className="tnum grid size-6 shrink-0 place-items-center rounded-md border border-line bg-surface font-mono text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">{s.title}</span>
                    <span className="block truncate text-xs text-muted">{s.note}</span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 -translate-x-1 text-subtle opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}
