"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import {
  BarChart3,
  Heart,
  LibraryBig,
  LogIn,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { useReadingRhythm } from "@/lib/use-reading-rhythm";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const rhythmQuery = useReadingRhythm({ enabled: status === "authenticated" });
  const rhythm = rhythmQuery.data;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (status === "loading") {
    return <div className="h-11 w-11 rounded-full skeleton" />;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-2">
        {/* Log in shows on the mobile top bar (< md) and again at lg+. In the
            md tier the bar is tightest, so we keep a single auth affordance —
            the Sign up pill — and rely on the signup page's link to /login. */}
        <Link
          href="/login"
          className={buttonClassName({
            variant: "ghost",
            size: "sm",
            className: "px-2.5 sm:px-3 md:hidden lg:inline-flex",
          })}
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Log in
        </Link>
        <Link
          href="/signup"
          className={buttonClassName({
            size: "sm",
            className: "hidden px-2.5 sm:inline-flex lg:px-3",
          })}
        >
          Sign up
        </Link>
      </div>
    );
  }

  const initial =
    session.user.name?.[0]?.toUpperCase() ??
    session.user.email?.[0]?.toUpperCase() ??
    "U";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground focus-visible:ring-2 focus-visible:ring-focus"
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        {initial}
        {rhythm?.readToday && (
          <span
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-library shadow-[0_0_14px_var(--library)]"
            aria-hidden="true"
          />
        )}
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium">
              {session.user.name ?? "Reader"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session.user.email}
            </p>
            {rhythm && rhythm.rhythmDays > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-library-line bg-library-surface px-2.5 py-2 text-xs font-semibold text-library-foreground">
                <span
                  className="h-2 w-2 rounded-full bg-library shadow-[0_0_12px_var(--library)]"
                  aria-hidden="true"
                />
                <span>{rhythm.rhythmDays}-day rhythm</span>
                {rhythm.readToday && (
                  <span className="ml-auto text-discovery-foreground">
                    Read today
                  </span>
                )}
              </div>
            )}
          </div>
          <Link
            href="/favorites"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2 px-4 text-sm hover:bg-muted focus-visible:bg-muted"
          >
            <UserIcon className="h-4 w-4" /> My Library
          </Link>
          <Link
            href="/shelves"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2 px-4 text-sm hover:bg-muted focus-visible:bg-muted"
          >
            <LibraryBig className="h-4 w-4" /> Shelves
          </Link>
          <Link
            href="/analytics"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2 px-4 text-sm hover:bg-muted focus-visible:bg-muted"
          >
            <BarChart3 className="h-4 w-4" /> Chapter Pulse
          </Link>
          <Link
            href="/support"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2 px-4 text-sm hover:bg-muted focus-visible:bg-muted"
          >
            <Heart className="h-4 w-4" /> Support Manga Orbit
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex min-h-11 w-full items-center gap-2 px-4 text-sm text-danger hover:bg-muted focus-visible:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
