"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Search, X, type LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  /** Optional leading visual: a lucide icon or a coloured dot class (e.g. "bg-critical"). */
  icon?: LucideIcon;
  dot?: string;
  count?: number;
}

/**
 * Filter chip with a custom dropdown. `value === ""` means "no filter": the chip is drawn dashed
 * with just its label; once set it becomes solid, shows the chosen value and an inline clear button.
 */
export function FilterSelect({
  label,
  icon: Icon,
  value,
  onChange,
  options,
  searchable,
  align = "start",
}: {
  label: string;
  icon?: LucideIcon;
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
  searchable?: boolean;
  align?: "start" | "end";
}) {
  const [q, setQ] = useState("");
  const active = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter((o) => o.label.toLowerCase().includes(n)) : options;
  }, [options, q]);

  return (
    <div className="relative inline-flex">
      <Menu.Root onOpenChange={(o) => !o && setQ("")}>
        <Menu.Trigger
          className={cn(
            "group inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ink/10 data-[state=open]:bg-hover",
            active ? "border-line-strong bg-surface pr-7 text-ink shadow-card" : "border-dashed border-line-strong text-muted hover:border-[#c5c5cd] hover:bg-surface hover:text-ink",
          )}
        >
          {Icon ? <Icon className="size-3.5 text-subtle" aria-hidden /> : null}
          <span>{label}</span>
          {active ? (
            <>
              <span className="h-3.5 w-px bg-line-strong" aria-hidden />
              {active.dot ? <span className={cn("size-1.5 rounded-full", active.dot)} aria-hidden /> : null}
              <span className="max-w-36 truncate text-ink">{active.label}</span>
            </>
          ) : (
            <ChevronDown className="size-3.5 text-subtle transition-transform group-data-[state=open]:rotate-180" aria-hidden />
          )}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align={align}
            sideOffset={6}
            className="data-[state=open]:animate-pop-in z-50 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-[11px] font-medium tracking-[0.05em] text-subtle uppercase">{label}</span>
              {active ? (
                <Menu.Item onSelect={() => onChange("")} className="cursor-pointer rounded px-1 text-[11.5px] font-medium text-muted outline-none hover:text-ink data-[highlighted]:text-ink">
                  Clear
                </Menu.Item>
              ) : null}
            </div>
            {searchable ? (
              <div className="relative border-b border-line">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  // Keep typing in the box instead of triggering the menu's typeahead.
                  onKeyDown={(e) => e.key !== "ArrowDown" && e.key !== "Escape" && e.stopPropagation()}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  aria-label={`Search ${label.toLowerCase()}`}
                  className="h-9 w-full bg-transparent pr-3 pl-8 text-[13px] placeholder:text-subtle focus:outline-none"
                />
              </div>
            ) : null}
            <Menu.RadioGroup value={value} onValueChange={onChange} className="scroll-thin max-h-72 overflow-y-auto p-1">
              {shown.length === 0 ? <p className="px-2.5 py-3 text-center text-[12.5px] text-subtle">No matches</p> : null}
              {shown.map((o) => (
                <Menu.RadioItem
                  key={o.value}
                  value={o.value}
                  className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] text-ink-2 outline-none select-none data-[highlighted]:bg-hover data-[highlighted]:text-ink data-[state=checked]:font-medium data-[state=checked]:text-ink"
                >
                  {o.dot ? <span className={cn("size-1.5 shrink-0 rounded-full", o.dot)} aria-hidden /> : o.icon ? <o.icon className="size-3.5 shrink-0 text-subtle" aria-hidden /> : null}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.count != null ? <span className="tnum text-[11.5px] text-subtle">{o.count}</span> : null}
                  <span className="grid w-3.5 place-items-center">
                    <Menu.ItemIndicator>
                      <Check className="size-3.5 text-ink" strokeWidth={2.5} aria-hidden />
                    </Menu.ItemIndicator>
                  </span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      {active ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Clear ${label} filter`}
          className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-subtle transition-colors hover:bg-hover hover:text-ink"
        >
          <X className="size-3" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Toolbar row for filter chips; wraps on narrow screens. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5", className)}>{children}</div>;
}

/** Date presets shared by the list views. */
export const DATE_PRESETS: FilterOption[] = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export function withinDays(iso: string | null | undefined, days: string, now = Date.now()) {
  if (!days) return true;
  if (!iso) return false;
  return now - new Date(iso).getTime() <= Number(days) * 86_400_000;
}
