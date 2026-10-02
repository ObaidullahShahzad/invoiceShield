"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="data-[state=open]:animate-overlay-in fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" />
      <D.Content
        className={cn(
          "data-[state=open]:animate-dialog-in fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface shadow-pop focus:outline-none",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <D.Title className="text-[15px] font-semibold tracking-[-0.01em]">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-[13px] leading-relaxed text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close aria-label="Close" className="-mt-1 -mr-1.5 rounded-md p-1.5 text-subtle transition-colors hover:bg-hover hover:text-ink">
            <X className="size-4" aria-hidden />
          </D.Close>
        </div>
        <div className="px-5 py-4">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

/** Footer row for dialog actions; sits flush with the dialog edges. */
export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="-mx-5 mt-5 -mb-4 flex justify-end gap-2 rounded-b-xl border-t border-line bg-sunken/60 px-5 py-3">{children}</div>;
}
