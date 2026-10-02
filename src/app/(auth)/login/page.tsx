import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { LoginAside } from "@/components/auth/login-aside";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Only allow same-site relative redirects.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <LoginAside />
      <section className="relative flex items-center justify-center bg-surface px-6 py-12">
        <LoginForm next={safeNext} />
        <p className="absolute right-0 bottom-6 left-0 text-center text-[11.5px] text-subtle">Prototype · use synthetic data only</p>
      </section>
    </main>
  );
}
