"use client";
import { CircleCheck, Flag, RotateCcw, ShieldOff, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/inputs";
import { availableActions, NOTE_REQUIRED } from "@/lib/domain/scoring";
import type { ReviewAction, ReviewStatus } from "@/lib/domain/types";

const ACTIONS: Record<ReviewAction, { label: string; icon: LucideIcon; variant: "primary" | "secondary" | "danger"; title: string; help: string; done: string; noteLabel: string }> = {
  mark_reviewed: { label: "Mark reviewed", icon: CircleCheck, variant: "primary", title: "Mark as reviewed", help: "Confirms you have checked the evidence. This is recorded in the audit trail and can be reopened.", done: "Marked as reviewed", noteLabel: "Note (optional)" },
  flag: { label: "Flag", icon: Flag, variant: "danger", title: "Flag for investigation", help: "Escalates this invoice. Explain what needs to be verified so the next person has context.", done: "Flagged for investigation", noteLabel: "What needs to be verified?" },
  clear: { label: "Clear flag", icon: ShieldOff, variant: "secondary", title: "Clear flag", help: "Record why the concern is resolved — for example, who confirmed the details and how.", done: "Flag cleared", noteLabel: "Why is the flag cleared?" },
  reopen: { label: "Reopen", icon: RotateCcw, variant: "secondary", title: "Reopen for review", help: "Return this invoice to the review queue.", done: "Reopened for review", noteLabel: "Reason for reopening" },
};

// Primary action last so it sits at the right edge, where the eye ends.
const ORDER: ReviewAction[] = ["reopen", "clear", "flag", "mark_reviewed"];

export function ReviewActions({ invoiceId, status, disabled }: { invoiceId: string; status: ReviewStatus; disabled?: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState<ReviewAction | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const actions = [...availableActions(status)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const meta = active ? ACTIONS[active] : null;
  const required = active ? NOTE_REQUIRED.includes(active) : false;

  async function confirm() {
    if (!active) return;
    if (required && !note.trim()) return setErr("A note is required for this action.");
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: active, note: note.trim() || undefined }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not update the status.");
      toast.success(ACTIONS[active].done);
      setActive(null);
      setNote("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update the status.");
    } finally {
      setBusy(false);
    }
  }

  if (!actions.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => {
          const m = ACTIONS[a];
          return (
            <Button
              key={a}
              variant={m.variant}
              disabled={disabled}
              onClick={() => {
                setActive(a);
                setNote("");
                setErr(null);
              }}
            >
              <m.icon className="size-4" aria-hidden /> {m.label}
            </Button>
          );
        })}
      </div>
      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        {meta ? (
          <DialogContent title={meta.title} description={meta.help}>
            <Field label={meta.noteLabel} error={err}>
              {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={required ? "Required" : "Optional"} autoFocus />}
            </Field>
            <p className="mt-1.5 text-right text-[11px] text-subtle tnum">{note.length}/1000</p>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button variant={meta.variant === "danger" ? "danger" : "primary"} loading={busy} onClick={confirm} className={meta.variant === "danger" ? "border-critical bg-critical text-white hover:bg-critical/90" : undefined}>
                {meta.title}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
