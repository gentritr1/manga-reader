"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Heart, LibraryBig, Gift } from "lucide-react";
import { YomiMark } from "@/components/brand/yomi-mark";
import { CommandPalette } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", icon: BookOpen },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/favorites", label: "Library", icon: Heart },
  { href: "/shelves", label: "Shelves", icon: LibraryBig },
  { href: "/support", label: "Support", icon: Gift },
];

export function Navbar() {
  const pathname = usePathname();
  // Hide global chrome inside the immersive reader.
  if (pathname.includes("/read")) return null;
  const compactHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 border-b border-line-subtle bg-surface-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 sm:h-16 sm:flex-nowrap sm:gap-6 sm:py-0">
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="Yomi home"
        >
          <YomiMark className="h-11 w-11 shrink-0 [filter:drop-shadow(0_10px_18px_rgb(36_19_95_/_0.22))]" />
          <span className="text-lg font-black tracking-tight">
            Yomi
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-surface-muted text-content-primary"
                    : "text-content-secondary hover:text-content-primary",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div
          className={cn(
            "order-3 flex min-w-0 basis-full justify-end sm:order-none sm:basis-auto sm:flex-1",
            compactHome && "hidden sm:flex",
          )}
        >
          <CommandPalette className="w-full sm:w-[240px] md:w-[280px]" />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          <nav className="flex items-center gap-1 md:hidden" aria-label="Quick links">
            {links.slice(1).map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-focus",
                    active
                      ? "bg-surface-muted text-content-primary"
                      : "text-content-secondary hover:bg-surface-muted/70 hover:text-content-primary",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </Link>
              );
            })}
          </nav>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <nav
        className={cn(
          "mx-auto grid max-w-7xl grid-cols-5 gap-1 px-4 pb-3 md:hidden",
          compactHome && "hidden",
        )}
        aria-label="Primary"
      >
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors",
                active
                  ? "bg-surface-muted text-content-primary"
                  : "text-content-secondary hover:bg-surface-muted/70 hover:text-content-primary",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
