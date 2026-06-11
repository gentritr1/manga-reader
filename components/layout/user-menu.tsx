"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClassName } from "@/components/ui/button";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

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
        <Link
          href="/login"
          className={buttonClassName({
            variant: "ghost",
            size: "icon",
            className: "sm:w-auto sm:px-3",
          })}
        >
          <LogIn className="h-4 w-4 sm:hidden" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Log in</span>
        </Link>
        <Link
          href="/signup"
          className={buttonClassName({ size: "sm", className: "hidden sm:inline-flex" })}
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
        className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        {initial}
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium">
              {session.user.name ?? "Reader"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session.user.email}
            </p>
          </div>
          <Link
            href="/favorites"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2 px-4 text-sm hover:bg-muted focus-visible:bg-muted"
          >
            <UserIcon className="h-4 w-4" /> My Library
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
