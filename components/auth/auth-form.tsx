"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Lock, Mail, User } from "lucide-react";
import { YomiMark } from "@/components/brand/yomi-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function authIntro(callbackUrl: string, isSignup: boolean) {
  if (callbackUrl.startsWith("/shelves")) {
    return isSignup
      ? "Create an account to build shelves that follow your reading mood."
      : "Log in to organize titles into shelves that stay with you.";
  }

  if (callbackUrl.startsWith("/analytics")) {
    return isSignup
      ? "Create an account to start building your Chapter Pulse."
      : "Log in to see your Chapter Pulse and export your recap.";
  }

  if (callbackUrl.startsWith("/favorites")) {
    return isSignup
      ? "Create an account to save titles and return to them later."
      : "Log in to access your library.";
  }

  return isSignup
    ? "Build your library and sync your reading."
    : "Log in to access your library.";
}

export function AuthForm({
  mode,
  googleEnabled,
}: {
  mode: "login" | "signup";
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignup) {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Could not create account");
          return;
        }
      }
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-[calc(100vh-4rem)] w-full items-center justify-center overflow-hidden px-4 py-12">
      {/* Ambient brand glow: vibrance without clutter, framing the card. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-[-10%] h-72 w-72 rounded-full bg-brand-primary/25 blur-[120px]" />
        <div className="absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-discovery/20 blur-[120px]" />
        <div className="absolute bottom-[-12%] left-1/3 h-72 w-72 rounded-full bg-action-primary/15 blur-[120px]" />
      </div>

      <div className="yomi-rise w-full max-w-md rounded-2xl border border-line-subtle bg-surface-panel/70 p-6 shadow-[var(--elevation-panel)] backdrop-blur-xl sm:p-8">
        <div className="mb-7 text-center">
          <YomiMark className="mx-auto mb-4 h-12 w-12 [filter:drop-shadow(0_12px_22px_rgb(36_19_95_/_0.28))]" />
          <h1 className="text-2xl font-extrabold tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-content-secondary">
            {authIntro(callbackUrl, isSignup)}
          </p>
        </div>

        {googleEnabled && (
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={() => signIn("google", { callbackUrl })}
              className="w-full"
            >
              Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3 text-xs text-content-secondary">
              <span className="h-px flex-1 bg-line-subtle" /> or{" "}
              <span className="h-px flex-1 bg-line-subtle" />
            </div>
          </>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          {isSignup && (
            <Field icon={User}>
              <Input
                placeholder="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="pl-10"
              />
            </Field>
          )}
          <Field icon={Mail}>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="pl-10"
            />
          </Field>
          <Field icon={Lock}>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={isSignup ? 8 : undefined}
              className="pl-10"
            />
          </Field>
          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full shadow-action-primary/25 hover:brightness-110"
            disabled={loading}
          >
            {loading ? "Please wait…" : isSignup ? "Create account" : "Log in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-content-secondary">
          {isSignup ? "Already have an account? " : "Don’t have an account? "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-semibold text-brand-primary hover:underline"
          >
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon
        aria-hidden={true}
        className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-content-secondary"
      />
      {children}
    </div>
  );
}
