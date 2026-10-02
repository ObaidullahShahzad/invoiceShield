"use client";
import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Building2, ChevronRight, ChevronsUpDown, FileText, LayoutGrid, LogOut, PanelLeft, ScrollText, Search, Upload, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AiStatusChip } from "@/components/layout/ai-status";
import { BrandMark } from "@/components/layout/brand";
import { Kbd } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/vendors", label: "Vendors", icon: Building2 },
  { href: "/audit", label: "Audit trail", icon: ScrollText },
];

const CRUMB: Record<string, string> = { dashboard: "Overview", invoices: "Invoices", vendors: "Vendors", audit: "Audit trail", new: "Upload" };

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href) && !pathname.startsWith("/invoices/new"));
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="space-y-px">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
              active ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line),0_1px_2px_rgb(17_17_19/0.05)]" : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            <Icon className={cn("size-4", active ? "text-ink" : "text-subtle group-hover:text-ink-2")} strokeWidth={1.85} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const uploading = pathname.startsWith("/invoices/new");
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <BrandMark />
      </div>
      <div className="px-3 pt-2">
        <Link
          href="/invoices/new"
          onClick={onNavigate}
          aria-current={uploading ? "page" : undefined}
          className="flex h-9 items-center justify-center gap-2 rounded-lg bg-ink text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(17_17_19/0.2)] transition-colors hover:bg-ink-2"
        >
          <Upload className="size-4" aria-hidden /> Upload invoice
        </Link>
        <p className="mt-6 mb-1.5 px-2.5 text-[11px] font-medium tracking-[0.04em] text-subtle uppercase">Workspace</p>
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="mt-auto p-3">
        <AiStatusChip />
      </div>
    </div>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[13px] md:flex">
      <span className="text-subtle">Finance</span>
      {parts.map((p, i) => {
        const href = "/" + parts.slice(0, i + 1).join("/");
        const last = i === parts.length - 1;
        const label = CRUMB[p] ?? "Detail";
        return (
          <span key={href} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="size-3.5 shrink-0 text-line-strong" aria-hidden />
            {last ? (
              <span aria-current="page" className="truncate font-medium text-ink">{label}</span>
            ) : (
              <Link href={href} className="truncate text-muted transition-colors hover:text-ink">{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function AppShell({ user, children }: { user: { name: string; email: string }; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const main = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Soft fade on route change; individual pages add their own staggered reveals.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(main.current, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power1.out", clearProps: "opacity" });
      });
      return () => mm.revert();
    },
    { dependencies: [pathname] },
  );

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    toast.success("Signed out");
    router.replace("/login");
    router.refresh();
  }

  const initials =
    user.name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[244px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-canvas lg:block">
        <SidebarBody />
      </aside>

      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="data-[state=open]:animate-overlay-in fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 border-r border-line bg-canvas shadow-pop focus:outline-none lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Main navigation menu</Dialog.Description>
            <Dialog.Close aria-label="Close menu" className="absolute top-3.5 right-3 rounded-md p-1.5 text-subtle hover:bg-hover hover:text-ink">
              <X className="size-4" aria-hidden />
            </Dialog.Close>
            <SidebarBody onNavigate={() => setDrawer(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-col bg-canvas">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink lg:hidden"
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
          >
            <PanelLeft className="size-[18px]" aria-hidden />
          </button>
          <Breadcrumbs />

          <form
            role="search"
            className="relative ml-auto w-full max-w-xs flex-1 md:flex-none"
            onSubmit={(e) => {
              e.preventDefault();
              const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
              router.push(q ? `/invoices?q=${encodeURIComponent(q)}` : "/invoices");
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              ref={search}
              name="q"
              type="search"
              aria-label="Search invoices"
              placeholder="Search invoices, vendors…"
              className="h-8 w-full rounded-lg border border-line bg-surface pr-12 pl-8 text-[13px] shadow-card transition-[border-color,box-shadow] placeholder:text-subtle hover:border-line-strong focus:border-ink/30 focus:ring-[3px] focus:ring-ink/[0.06] focus:outline-none"
            />
            <Kbd className="pointer-events-none absolute top-1/2 right-1.5 hidden -translate-y-1/2 sm:inline-flex">⌘K</Kbd>
          </form>

          <Menu.Root>
            <Menu.Trigger className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 transition-colors hover:bg-hover data-[state=open]:bg-hover" aria-label="Account menu">
              <span className="grid size-7 place-items-center rounded-full border border-line bg-surface text-[11px] font-semibold text-ink-2">{initials}</span>
              <span className="hidden text-left xl:block">
                <span className="block max-w-36 truncate text-[12.5px] leading-4 font-medium">{user.name}</span>
                <span className="block text-[11px] leading-4 text-subtle">Reviewer</span>
              </span>
              <ChevronsUpDown className="size-3.5 text-subtle" aria-hidden />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} className="data-[state=open]:animate-pop-in z-50 min-w-60 rounded-xl border border-line bg-surface p-1 shadow-pop">
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{initials}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                </div>
                <Menu.Separator className="my-1 h-px bg-line" />
                <Menu.Item onSelect={signOut} className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[13px] text-ink-2 outline-none data-[highlighted]:bg-hover data-[highlighted]:text-ink">
                  <LogOut className="size-4 text-subtle" aria-hidden /> Sign out
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </header>
        <main ref={main} id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-7 sm:px-8 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
