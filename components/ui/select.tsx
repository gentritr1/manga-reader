"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

// Accessible custom listbox: a styled trigger + animated popover, so Sort/Status
// match the rest of the UI instead of rendering the OS-native control.
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduceMotion = useReducedMotion();
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) setActiveIndex(options.findIndex((o) => o.value === value));
  }, [open, options, value]);

  // Keep the highlighted option in view during keyboard navigation.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(activeIndex);
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-line-subtle bg-surface-panel px-3.5 text-sm font-medium text-content-primary transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-content-secondary transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-full z-30 mt-1.5 max-h-64 min-w-full overflow-auto rounded-xl border border-line-subtle bg-surface-panel/95 p-1 shadow-[var(--elevation-panel)] backdrop-blur-xl"
          >
            {options.map((o, i) => {
              const selected = o.value === value;
              const active = i === activeIndex;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(i)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "bg-surface-muted text-content-primary" : "text-content-secondary",
                    selected && "font-semibold text-content-primary",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {selected && (
                    <Check className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
