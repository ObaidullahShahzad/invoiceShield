"use client";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ArrowRight, CircleAlert, Eye, EyeOff, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/inputs";
import { Notice } from "@/components/ui/misc";
import { clientAuth, firebaseConfigured } from "@/lib/firebase/client";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Use at least 8 characters for the password.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and retry.",
  "auth/operation-not-allowed": "Email/password sign-in is not enabled in the Firebase console.",
};

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    const name = String(f.get("name") ?? "").trim();
    setError(null);
    if (mode === "signup" && password.length < 8) return setError(MESSAGES["auth/weak-password"]);
    setBusy(true);
    try {
      const auth = clientAuth();
      const cred =
        mode === "signup" ? await createUserWithEmailAndPassword(auth, email, password) : await signInWithEmailAndPassword(auth, email, password);
      if (mode === "signup" && name) await updateProfile(cred.user, { displayName: name });
      const idToken = await cred.user.getIdToken(true);
      const res = await fetch("/api/auth/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
      if (!res.ok) throw new Error("session");
      router.replace(next);
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError((code && MESSAGES[code]) || "We couldn’t sign you in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[360px]">
      <BrandMark className="mb-12 lg:hidden" />
      <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{mode === "signin" ? "Sign in" : "Create your account"}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
        {mode === "signin" ? "Use your reviewer account to continue." : "Accounts start with reviewer access. Use synthetic data only in this prototype."}
      </p>

      {!firebaseConfigured ? (
        <Notice tone="warning" icon={TriangleAlert} className="mt-6">
          Firebase is not configured. Copy <code className="font-mono text-xs">.env.example</code> to <code className="font-mono text-xs">.env.local</code> and add your project values.
        </Notice>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {mode === "signup" ? (
          <Field label="Full name">{(p) => <Input {...p} name="name" autoComplete="name" placeholder="Ayesha Khan" />}</Field>
        ) : null}
        <Field label="Work email">{(p) => <Input {...p} name="email" type="email" autoComplete="email" required placeholder="you@company.com" />}</Field>
        <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
          {(p) => (
            <div className="relative">
              <Input {...p} name="password" type={show ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} required className="pr-10" />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-subtle transition-colors hover:text-ink"
              >
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
          )}
        </Field>

        {error ? (
          <Notice tone="error" icon={CircleAlert}>
            {error}
          </Notice>
        ) : null}

        <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!firebaseConfigured} className="group w-full justify-center">
          {mode === "signin" ? "Continue" : "Create account"}
          {busy ? null : <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />}
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-center text-[13px] text-muted">
        {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="font-medium text-ink underline decoration-line-strong underline-offset-[3px] transition-colors hover:decoration-ink"
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
