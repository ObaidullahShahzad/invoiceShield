"use client";
import { RotateCcw, ServerCrash } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <EmptyState
        icon={ServerCrash}
        title="Something went wrong"
        description={`We couldn’t load this page. Check that Firebase is configured, then retry.${error.digest ? ` Reference: ${error.digest}` : ""}`}
        action={
          <Button variant="primary" onClick={reset}>
            <RotateCcw className="size-4" aria-hidden /> Try again
          </Button>
        }
      />
    </main>
  );
}
