"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Heart } from "lucide-react";
import { SearchBar } from "./search-bar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", icon: BookOpen },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/favorites", label: "Library", icon: Heart },
];

export function Navbar() {
  const pathname = usePathname();
  // Hide global chrome inside the immersive reader.
  if (pathname.includes("/read")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 sm:h-16 sm:flex-nowrap sm:gap-6 sm:py-0">
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Yomi home"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="hidden text-lg font-bold tracking-tight sm:block">
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
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="order-3 flex min-w-0 basis-full justify-end sm:order-none sm:basis-auto sm:flex-1">
          <SearchBar className="w-full min-w-0 sm:max-w-xs" />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <nav
        className="mx-auto flex max-w-7xl gap-2 px-4 pb-3 md:hidden"
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
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
