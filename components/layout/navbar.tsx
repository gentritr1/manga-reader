"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { YomiMark } from "@/components/brand/yomi-mark";
import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { NAV_LINKS, isActiveNav } from "./nav-config";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  // Hide global chrome inside the immersive reader.
  if (pathname.includes("/read")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-line-subtle bg-surface-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3">
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="Manga Orbit home"
        >
          <YomiMark className="h-10 w-10 shrink-0 [filter:drop-shadow(0_10px_18px_rgb(36_19_95_/_0.22))]" />
          <span className="hidden font-display text-lg font-extrabold tracking-tight min-[420px]:inline">
            Manga Orbit
          </span>
        </Link>

        {/* Desktop primary nav. On mobile this lives in the bottom tab bar. */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActiveNav(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-surface-muted text-content-primary"
                    : "text-content-secondary hover:text-content-primary hover:bg-surface-muted/60",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Search: a ghost icon on phones, a field that grows to fill (capped)
            from sm up so it never wraps or crowds at in-between widths. */}
        <div className="flex min-w-0 flex-1 justify-end">
          <CommandPalette className="w-11 shrink-0 sm:w-full sm:max-w-[22rem] sm:shrink" />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
