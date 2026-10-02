"use client";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardData } from "@/lib/domain/analytics";
import { formatMoney } from "@/lib/domain/money";
import { RISK_LABEL } from "@/lib/domain/scoring";

/**
 * Monochrome chart palette: greys encode intensity, and only the critical tier uses colour.
 * Legends always carry labels so colour is never the sole signal.
 */
export const CHART = {
  low: "#d9d9de",
  medium: "#a3a3ad",
  high: "#4a4a53",
  critical: "#b4232b",
  ink: "#26262c",
  soft: "#bcbcc4",
  grid: "#efeff2",
  axis: "#9d9da7",
  label: "#3a3a42",
  cursor: "#f4f4f5",
};

const tickStyle = { fontSize: 11.5, fill: CHART.axis };

function TooltipBox({ active, payload, label, money }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: { fill?: string } }[]; label?: string; money?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      {label ? <p className="mb-1.5 font-medium text-ink">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <p key={i} className="flex items-center gap-2 text-muted">
            <span className="size-2 rounded-[2px]" style={{ background: p.color ?? p.payload?.fill }} aria-hidden />
            {p.name}
            <span className="tnum ml-auto pl-3 font-medium text-ink">{money ? formatMoney(p.value as number, money, { compact: true }) : p.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden>
      {items.map(([n, c]) => (
        <li key={n} className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px]" style={{ background: c }} />
          {n}
        </li>
      ))}
    </ul>
  );
}

export function WeeklyChart({ data }: { data: DashboardData["weekly"] }) {
  const total = data.reduce((s, w) => s + w.low + w.medium + w.high, 0);
  return (
    <figure>
      <figcaption className="sr-only">Invoices analysed per week by risk level. {total} invoices in the last eight weeks.</figcaption>
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-xs text-muted">
          <span className="tnum font-medium text-ink">{total}</span> analysed · last 8 weeks
        </p>
        <Legend items={[["Low", CHART.low], ["Medium", CHART.medium], ["High / critical", CHART.high]]} />
      </div>
      <div className="h-60" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barCategoryGap="34%">
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tickStyle} dy={6} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={tickStyle} />
            <Tooltip cursor={{ fill: CHART.cursor, radius: 4 }} content={<TooltipBox />} />
            <Bar dataKey="low" name="Low" stackId="a" fill={CHART.low} animationDuration={700} />
            <Bar dataKey="medium" name="Medium" stackId="a" fill={CHART.medium} animationDuration={700} />
            <Bar dataKey="high" name="High / critical" stackId="a" fill={CHART.high} radius={[3, 3, 0, 0]} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function RiskDonut({ data }: { data: DashboardData["risk"] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const rows = data.map((d) => ({ name: RISK_LABEL[d.level], value: d.count, level: d.level }));
  return (
    <figure>
      <figcaption className="sr-only">Risk distribution: {rows.map((r) => `${r.name} ${r.value}`).join(", ")}.</figcaption>
      <div className="relative h-44" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total ? rows : [{ name: "None", value: 1, level: "low" as const }]}
              dataKey="value"
              innerRadius={60}
              outerRadius={76}
              paddingAngle={total ? 2.5 : 0}
              cornerRadius={2}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              animationDuration={800}
            >
              {(total ? rows : [{ level: "low" as const }]).map((r, i) => (
                <Cell key={i} fill={total ? CHART[r.level] : CHART.grid} />
              ))}
            </Pie>
            {total ? <Tooltip content={<TooltipBox />} /> : null}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="tnum text-[26px] leading-none font-semibold tracking-[-0.03em]">{total}</p>
            <p className="mt-1 text-[11px] font-medium tracking-[0.04em] text-subtle uppercase">Analysed</p>
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-[13px]">
        {rows.map((r) => {
          const pct = total ? Math.round((r.value / total) * 100) : 0;
          return (
            <li key={r.level} className="flex items-center gap-2.5">
              <span className="size-2 rounded-[2px]" style={{ background: CHART[r.level] }} aria-hidden />
              <span className="text-ink-2">{r.name}</span>
              <span className="tnum ml-auto text-subtle">{pct}%</span>
              <span className="tnum w-8 text-right font-medium">{r.value}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/** Horizontal ranked list with inline bars — reads better than a chart for short categorical data. */
function RankedBars({ rows, format }: { rows: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink-2">{r.label}</span>
            <span className="tnum shrink-0 font-medium">{format ? format(r.value) : r.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full bg-ink/80 transition-[width] duration-700 ease-out" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RulesBar({ data }: { data: DashboardData["topRules"] }) {
  if (!data.length) return <p className="py-10 text-center text-[13px] text-muted">No findings yet.</p>;
  return (
    <figure>
      <figcaption className="sr-only">Most frequent findings: {data.map((d) => `${d.rule} ${d.count}`).join(", ")}.</figcaption>
      <RankedBars rows={data.map((d) => ({ label: d.rule, value: d.count }))} />
    </figure>
  );
}

export function VendorBar({ data, currency }: { data: DashboardData["vendorExposure"]; currency: string }) {
  if (!data.length) return <p className="py-10 text-center text-[13px] text-muted">Nothing awaiting review.</p>;
  return (
    <figure>
      <figcaption className="sr-only">Value awaiting review by vendor: {data.map((d) => `${d.vendor} ${formatMoney(d.valueMinor, currency, { compact: true })}`).join(", ")}.</figcaption>
      <RankedBars rows={data.map((d) => ({ label: d.vendor, value: d.valueMinor }))} format={(v) => formatMoney(v, currency, { compact: true })} />
    </figure>
  );
}
