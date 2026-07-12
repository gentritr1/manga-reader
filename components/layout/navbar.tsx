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
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="Manga Orbit home"
        >
          <YomiMark className="h-9 w-9 shrink-0 [filter:drop-shadow(0_10px_18px_rgb(36_19_95_/_0.22))]" />
          <span className="hidden font-display text-lg font-extrabold tracking-tight min-[420px]:inline">
            Manga Orbit
          </span>
        </Link>

        {/* Desktop primary nav (md+). Label-only — icons live in the mobile
            bottom tab bar. On phones this lives in that bottom tab bar. */}
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
          {NAV_LINKS.map(({ href, label }) => {
            const active = isActiveNav(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  active
                    ? "bg-surface-muted text-content-primary"
                    : "text-content-secondary hover:bg-surface-muted/60 hover:text-content-primary",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Search: an icon button that opens the ⌘K palette up through lg;
            it only expands into a full field at xl+ where there is room for
            the placeholder. No truncated-placeholder state exists at any width. */}
        <div className="flex min-w-0 flex-1 justify-end">
          <CommandPalette className="w-11 shrink-0 xl:w-full xl:max-w-[20rem] xl:shrink" />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
