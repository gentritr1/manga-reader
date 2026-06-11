import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "neutral" | "inverse" | "discovery" | "library" | "chapter";

const variants: Record<BadgeVariant, string> = {
  neutral:
    "border-line-subtle bg-surface-muted text-content-secondary",
  inverse:
    "border-line-inverse bg-surface-inverse-tint text-content-inverse-muted",
  discovery:
    "border-discovery-line bg-discovery-surface text-content-inverse",
  library:
    "border-library-line bg-library-surface text-library-foreground",
  chapter:
    "border-line-inverse bg-surface-spotlight/70 text-content-inverse",
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
