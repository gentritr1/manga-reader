import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "secondary" | "library";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  default:
    "bg-action-primary text-action-primary-foreground hover:brightness-110 shadow-sm shadow-action-primary/20",
  outline:
    "border border-line-subtle bg-transparent text-content-primary hover:bg-surface-muted",
  ghost: "bg-transparent text-content-primary hover:bg-surface-muted",
  secondary: "bg-surface-muted text-content-primary hover:bg-line-subtle",
  library:
    "border border-library-line bg-library-surface text-library-foreground hover:bg-library-surface/80",
};

const sizes: Record<Size, string> = {
  sm: "h-11 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-11 w-11",
};

export function buttonClassName({
  variant = "default",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  ),
);
Button.displayName = "Button";
