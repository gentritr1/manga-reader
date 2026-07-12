"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { NAV_LINKS, isActiveNav } from "./nav-config";
import { cn } from "@/lib/utils";

// Thumb-reachable primary nav for phones. Hidden in the immersive reader and on
// desktop (where the top bar carries the same links).
export function MobileTabBar() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  if (pathname.includes("/read")) return null;

  return (
    <>
      {/* Reserves flow space so the fixed bar never overlaps the footer. */}
      <div
        aria-hidden="true"
        className="md:hidden"
        style={{ height: "calc(4rem + env(safe-area-inset-bottom))" }}
      />
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line-subtle bg-surface-canvas/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActiveNav(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active
                    ? "text-brand-primary"
                    : "text-content-secondary hover:text-content-primary",
                )}
              >
                {active && (
                  <motion.span
                    aria-hidden="true"
                    layoutId={reduceMotion ? undefined : "mobile-tab-indicator"}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 500, damping: 32 }
                    }
                    className="absolute top-0 left-1/2 -ml-4 h-0.5 w-8 rounded-full bg-brand-primary"
                  />
                )}
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    active ? "scale-110" : "group-active:scale-90",
                  )}
                  aria-hidden="true"
                />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
