import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "neutral"
  | "inverse"
  | "discovery"
  | "library"
  | "chapter"
  | "status";

const variants: Record<BadgeVariant, string> = {
  neutral:
    "border-line-subtle bg-surface-muted text-content-secondary",
  inverse:
    "border-line-inverse bg-surface-inverse-tint text-content-inverse-muted",
  discovery:
    "border-discovery-line bg-discovery-surface text-content-inverse",
  library:
    "border-library-line bg-library-surface text-library-foreground",
  // Overlay pills that sit on cover art: one translucent dark surface with a
  // hairline so they read as chrome, not stickers pasted over the artwork.
  chapter:
    "border-line-inverse bg-status-pill text-status-pill-foreground backdrop-blur-md",
  status:
    "border-line-inverse bg-status-pill text-status-pill-foreground backdrop-blur-md",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
