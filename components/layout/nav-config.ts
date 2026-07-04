import { BookOpen, Compass, Heart, LibraryBig, type LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Primary destinations. Reading and discovery lead; Support lives in the footer
// and account menu, not the primary chrome. Shared by the desktop top bar and
// the mobile bottom tab bar so they never drift.
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: BookOpen },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/favorites", label: "Library", icon: Heart },
  { href: "/shelves", label: "Shelves", icon: LibraryBig },
];

export function isActiveNav(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
