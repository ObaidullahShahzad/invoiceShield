import { ArrowLeft, FileQuestion } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <EmptyState
        icon={FileQuestion}
        title="We couldn’t find that page"
        description="The invoice or page may have been removed, or the link is wrong."
        action={
          <Link href="/dashboard" className={buttonClass("primary")}>
            <ArrowLeft className="size-4" aria-hidden /> Back to overview
          </Link>
        }
      />
    </main>
  );
}
