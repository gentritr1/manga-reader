import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "secondary";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  default:
    "bg-accent text-accent-foreground hover:opacity-90 shadow-sm shadow-accent/20",
  outline:
    "border border-border bg-transparent hover:bg-muted text-foreground",
  ghost: "bg-transparent hover:bg-muted text-foreground",
  secondary: "bg-muted text-foreground hover:bg-border",
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
