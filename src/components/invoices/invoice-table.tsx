"use client";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileSearch, Search, SearchX, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { th } from "@/components/dashboard/review-queue";
import { RiskBadge, StatusBadge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldCls, Select } from "@/components/ui/inputs";
import { EmptyState } from "@/components/ui/misc";
import { formatMoney } from "@/lib/domain/money";
import type { InvoiceRecord } from "@/lib/domain/models";
import { cn, formatDate } from "@/lib/utils";

type SortKey = "createdAt" | "riskScore" | "totalMinor" | "vendorName";
const PAGE = 12;
const RISK_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };

type Sort = { key: SortKey; dir: "asc" | "desc" };

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "flagged", label: "Flagged" },
  { value: "reviewed", label: "Reviewed" },
];

function SortTh({ k, sort, onSort, children, right, className }: { k: SortKey; sort: Sort; onSort: (k: SortKey) => void; children: string; right?: boolean; className?: string }) {
  const active = sort.key === k;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn(th, right && "text-right", className)}>
      <button onClick={() => onSort(k)} className={cn("group inline-flex items-center gap-1 rounded transition-colors hover:text-ink", active && "text-ink", right && "flex-row-reverse")}>
        {children}
        <Icon className={cn("size-3", active ? "opacity-100" : "opacity-0 group-hover:opacity-60")} aria-hidden />
      </button>
    </th>
  );
}

export function InvoiceTable({ invoices, initialQuery = "", initialStatus = "all" }: { invoices: InvoiceRecord[]; initialQuery?: string; initialStatus?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [risk, setRisk] = useState("all");
  const [sort, setSort] = useState<Sort>({ key: "createdAt", dir: "desc" });
  const [page, setPage] = useState(0);

  const counts = useMemo(() => {
    const open = invoices.filter((i) => ["needs_review", "in_review", "flagged"].includes(i.reviewStatus)).length;
    return {
      all: invoices.length,
      open,
      flagged: invoices.filter((i) => i.reviewStatus === "flagged").length,
      reviewed: invoices.filter((i) => i.reviewStatus === "reviewed").length,
    } as Record<string, number>;
  }, [invoices]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = invoices.filter((i) => {
      if (needle && !`${i.invoiceNumber ?? ""} ${i.vendorName ?? ""} ${i.originalFileName}`.toLowerCase().includes(needle)) return false;
      if (status === "open" && !["needs_review", "in_review", "flagged"].includes(i.reviewStatus)) return false;
      if (status !== "all" && status !== "open" && i.reviewStatus !== status) return false;
      if (risk !== "all" && i.riskLevel !== risk) return false;
      return true;
    });
    const mul = sort.dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const av = sort.key === "riskScore" ? a.riskScore : sort.key === "totalMinor" ? (a.totalMinor ?? -1) : sort.key === "vendorName" ? (a.vendorName ?? "") : a.createdAt;
      const bv = sort.key === "riskScore" ? b.riskScore : sort.key === "totalMinor" ? (b.totalMinor ?? -1) : sort.key === "vendorName" ? (b.vendorName ?? "") : b.createdAt;
      return (av < bv ? -1 : av > bv ? 1 : 0) * mul || RISK_ORDER[b.riskLevel] - RISK_ORDER[a.riskLevel];
    });
    return out;
  }, [invoices, q, status, risk, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const slice = rows.slice(current * PAGE, current * PAGE + PAGE);
  const filtered = q || status !== "all" || risk !== "all";
  const isTab = STATUS_TABS.some((t) => t.value === status);

  const toggle = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "vendorName" ? "asc" : "desc" }));
    setPage(0);
  };
  const reset = () => {
    setQ("");
    setStatus("all");
    setRisk("all");
    setPage(0);
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <div role="tablist" aria-label="Review status" className="flex rounded-lg bg-sunken p-0.5">
          {STATUS_TABS.map((t) => {
            const on = status === t.value;
            return (
              <button
                key={t.value}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setStatus(t.value);
                  setPage(0);
                }}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-all",
                  on ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line),0_1px_2px_rgb(17_17_19/0.06)]" : "text-muted hover:text-ink",
                )}
              >
                {t.label}
                <span className={cn("tnum text-[11px]", on ? "text-muted" : "text-subtle")}>{counts[t.value]}</span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            type="search"
            aria-label="Filter invoices"
            placeholder="Filter by number, vendor or file"
            className={cn(fieldCls, "h-8 pl-8")}
          />
        </div>
        <Select
          aria-label="More statuses"
          value={isTab ? "" : status}
          onChange={(e) => {
            setStatus(e.target.value || "all");
            setPage(0);
          }}
          className="w-36 [&_select]:h-8"
        >
          <option value="">More statuses</option>
          <option value="needs_review">Needs review</option>
          <option value="cleared">Flag cleared</option>
          <option value="pending_analysis">Analyzing</option>
        </Select>
        <Select
          aria-label="Risk level"
          value={risk}
          onChange={(e) => {
            setRisk(e.target.value);
            setPage(0);
          }}
          className="w-32 [&_select]:h-8"
        >
          <option value="all">Any risk</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X className="size-3.5" aria-hidden /> Reset
          </Button>
        ) : null}
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={FileSearch} title="No invoices yet" description="Upload an invoice to start reviewing." action={<Link href="/invoices/new" className={buttonClass("primary")}>Upload invoice</Link>} />
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No invoices match these filters" description="Try a different search term or reset the filters." action={<Button onClick={reset}>Reset filters</Button>} />
      ) : (
        <>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <caption className="sr-only">Invoices</caption>
              <thead className="border-b border-line bg-sunken/60">
                <tr>
                  <th scope="col" className={`${th} pl-5`}>Invoice</th>
                  <SortTh k="vendorName" sort={sort} onSort={toggle}>Vendor</SortTh>
                  <th scope="col" className={th}>Date</th>
                  <SortTh k="totalMinor" sort={sort} onSort={toggle} right>Amount</SortTh>
                  <SortTh k="riskScore" sort={sort} onSort={toggle}>Risk</SortTh>
                  <th scope="col" className={th}>Status</th>
                  <SortTh k="createdAt" sort={sort} onSort={toggle} className="pr-5">Uploaded</SortTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {slice.map((i) => (
                  <tr key={i.id} className="relative transition-colors hover:bg-sunken/50">
                    <td className="py-2.5 pr-3 pl-5">
                      <Link href={`/invoices/${i.id}`} className="font-mono text-[12.5px] font-medium text-ink after:absolute after:inset-0">
                        {i.invoiceNumber ?? (i.analysisStatus === "failed" ? "Needs input" : "Processing…")}
                      </Link>
                      <p className="max-w-44 truncate text-[11.5px] text-subtle">{i.originalFileName}</p>
                    </td>
                    <td className="max-w-56 truncate px-3 py-2.5 text-ink-2">{i.vendorName ?? <span className="text-subtle">—</span>}</td>
                    <td className="tnum px-3 py-2.5 whitespace-nowrap text-muted">{formatDate(i.invoiceDate)}</td>
                    <td className="tnum px-3 py-2.5 text-right font-medium whitespace-nowrap">{formatMoney(i.totalMinor, i.currency)}</td>
                    <td className="px-3 py-2.5">
                      {i.analysisStatus === "completed" ? <RiskBadge level={i.riskLevel} score={i.riskScore} /> : <span className="text-xs text-subtle">{i.analysisStatus === "failed" ? "Failed" : "Pending"}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={i.reviewStatus} />
                    </td>
                    <td className="py-2.5 pr-5 pl-3 text-xs whitespace-nowrap text-subtle">{formatDate(i.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-[12.5px] text-muted">
            <span aria-live="polite">
              {rows.length === invoices.length ? (
                <>
                  <span className="tnum font-medium text-ink">{rows.length}</span> invoices
                </>
              ) : (
                <>
                  <span className="tnum font-medium text-ink">{rows.length}</span> of {invoices.length} invoices
                </>
              )}
            </span>
            <div className="flex items-center gap-1">
              <span className="tnum mr-2">
                Page {current + 1} of {pages}
              </span>
              <Button variant="secondary" size="icon-sm" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button variant="secondary" size="icon-sm" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
