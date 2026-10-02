"use client";
import { Cpu, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Status {
  provider: "ollama" | "openrouter" | "none";
  available: boolean;
  model: string | null;
  external: boolean;
}

export function AiStatusChip() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/ai/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => alive && setS(j.data))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!s) return <div className="h-[54px] animate-pulse rounded-lg bg-neutral-bg" aria-hidden />;
  const live = s.available;
  const title = live ? (s.external ? "External model" : "Local model") : "Rules-only mode";
  const detail = live ? s.model : s.provider === "none" ? "AI disabled in config" : "Model unreachable";
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5 shadow-card" role="status">
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
        {live ? <Cpu className="size-3.5 text-muted" aria-hidden /> : <TriangleAlert className="size-3.5 text-medium" aria-hidden />}
        {title}
        <span className="relative ml-auto flex size-2" aria-hidden>
          {live ? <span className="absolute inset-0 animate-ping rounded-full bg-low/40" /> : null}
          <span className={cn("relative size-2 rounded-full", live ? "bg-low" : "bg-medium")} />
        </span>
      </div>
      <p className="mt-0.5 truncate pl-[22px] font-mono text-[11px] text-subtle">{detail}</p>
    </div>
  );
}
