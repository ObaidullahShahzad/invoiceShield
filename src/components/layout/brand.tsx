import { cn } from "@/lib/utils";

/** Monogram: a shield outline with two ledger lines. */
export function LogoGlyph({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("grid size-7 place-items-center rounded-lg", inverted ? "bg-white text-ink" : "bg-ink text-white", className)}>
      <svg viewBox="0 0 24 24" className="size-[17px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2.8 4.5 5.6v5.9c0 4.6 3.1 8.2 7.5 9.7 4.4-1.5 7.5-5.1 7.5-9.7V5.6L12 2.8Z" />
        <path d="M8.8 10.2h6.4M8.8 13.6h4.2" />
      </svg>
    </span>
  );
}

export function BrandMark({ inverted, className }: { inverted?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoGlyph inverted={inverted} />
      <span className={cn("text-[15px] font-semibold tracking-[-0.02em]", inverted ? "text-white" : "text-ink")}>InvoiceShield</span>
    </div>
  );
}
