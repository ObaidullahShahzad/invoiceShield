"use client";
import { CalendarDays, History, ListFilter, Search, SearchX, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AUDIT_ICON, AUDIT_TONE } from "@/components/dashboard/activity";
import { th } from "@/components/dashboard/review-queue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DATE_PRESETS, FilterSelect, withinDays } from "@/components/ui/filter-select";
import { fieldCls } from "@/components/ui/inputs";
import { EmptyState } from "@/components/ui/misc";
import { AUDIT_ACTION_LABEL, type AuditEventRecord } from "@/lib/domain/models";
import { cn, formatDateTime } from "@/lib/utils";

const GROUPS = [
  { value: "all", label: "All events" },
  { value: "review.", label: "Decisions" },
  { value: "invoice.", label: "Processing" },
  { value: "vendor.", label: "Vendors" },
];

export function AuditLog({ events }: { events: AuditEventRecord[] }) {
  const [group, setGroup] = useState("all");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [days, setDays] = useState("");

  const actionOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) if (group === "all" || e.action.startsWith(group)) m.set(e.action, (m.get(e.action) ?? 0) + 1);
    return [...m.entries()].map(([a, n]) => ({ value: a, label: AUDIT_ACTION_LABEL[a] ?? a, icon: AUDIT_ICON[a] ?? History, count: n }));
  }, [events, group]);

  const actorOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) m.set(e.actorName, (m.get(e.actorName) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([a, n]) => ({ value: a, label: a, count: n }));
  }, [events]);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return events.filter((e) => {
      if (group !== "all" && !e.action.startsWith(group)) return false;
      if (action && e.action !== action) return false;
      if (actor && e.actorName !== actor) return false;
      if (!withinDays(e.createdAt, days)) return false;
      if (n && !`${e.invoiceLabel ?? ""} ${e.note ?? ""} ${e.newValue ?? ""} ${e.actorName} ${AUDIT_ACTION_LABEL[e.action] ?? e.action}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [events, group, action, actor, days, q]);

  const filtered = q || action || actor || days || group !== "all";
  const reset = () => {
    setGroup("all");
    setQ("");
    setAction("");
    setActor("");
    setDays("");
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <div role="tablist" aria-label="Event type" className="flex rounded-lg bg-sunken p-0.5">
          {GROUPS.map((g) => {
            const on = group === g.value;
            return (
              <button
                key={g.value}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setGroup(g.value);
                  setAction("");
                }}
                className={cn(
                  "h-7 rounded-md px-2.5 text-[12.5px] font-medium transition-all",
                  on ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line),0_1px_2px_rgb(17_17_19/0.06)]" : "text-muted hover:text-ink",
                )}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" aria-label="Search audit trail" placeholder="Search invoice, note or person" className={cn(fieldCls, "h-8 pl-8")} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-sunken/40 px-3 py-2">
        <span className="mr-1 text-[11px] font-medium tracking-[0.05em] text-subtle uppercase">Filters</span>
        <FilterSelect label="Action" icon={ListFilter} value={action} onChange={setAction} options={actionOptions} />
        <FilterSelect label="Person" icon={UserRound} searchable value={actor} onChange={setActor} options={actorOptions} />
        <FilterSelect label="Date" icon={CalendarDays} value={days} onChange={setDays} options={DATE_PRESETS} />
        <p className="ml-auto px-1 text-[12.5px] text-muted" aria-live="polite">
          <span className="tnum font-medium text-ink">{rows.length}</span> event{rows.length === 1 ? "" : "s"}
        </p>
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X className="size-3.5" aria-hidden /> Reset all
          </Button>
        ) : null}
      </div>
      {events.length === 0 ? (
        <EmptyState icon={History} title="No events" description="Actions will appear here as they happen." />
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No events match these filters" description="Try a different search or reset the filters." action={<Button onClick={reset}>Reset filters</Button>} />
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-[13px]">
            <caption className="sr-only">Audit trail, newest first</caption>
            <thead className="border-b border-line bg-sunken/60">
              <tr>
                <th scope="col" className={`${th} pl-5`}>When</th>
                <th scope="col" className={th}>Action</th>
                <th scope="col" className={th}>Invoice</th>
                <th scope="col" className={th}>By</th>
                <th scope="col" className={`${th} pr-5`}>Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => {
                const Icon = AUDIT_ICON[e.action] ?? History;
                return (
                  <tr key={e.id} className="align-top transition-colors hover:bg-sunken/50">
                    <td className="tnum py-3 pr-3 pl-5 font-mono text-[11.5px] whitespace-nowrap text-muted">
                      <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 font-medium whitespace-nowrap">
                        <Icon className={cn("size-3.5 text-subtle", AUDIT_TONE[e.action])} aria-hidden />
                        {AUDIT_ACTION_LABEL[e.action] ?? e.action}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[12.5px]">
                      {e.invoiceId ? (
                        <Link href={`/invoices/${e.invoiceId}`} className="underline decoration-line-strong underline-offset-[3px] transition-colors hover:decoration-ink">
                          {e.invoiceLabel ?? e.invoiceId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-2">{e.actorName}</td>
                    <td className="max-w-80 py-3 pr-5 pl-3 text-[12.5px] text-muted">
                      {e.previousValue && e.newValue && e.action.startsWith("review.") ? (
                        <span>
                          {e.previousValue} <span className="text-subtle">→</span> {e.newValue}
                        </span>
                      ) : e.newValue && !e.action.startsWith("invoice.uploaded") ? (
                        <span className="line-clamp-2">{e.newValue}</span>
                      ) : null}
                      {e.note ? <p className="mt-1 border-l-2 border-line-strong pl-2 text-ink-2">{e.note}</p> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
