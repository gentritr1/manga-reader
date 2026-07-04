"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/lib/use-favorites";
import { cn } from "@/lib/utils";

interface Props {
  mangaId: string;
  title: string;
  coverUrl?: string | null;
  variant?: "icon" | "full";
  size?: "sm" | "md" | "lg" | "icon";
  className?: string;
  compactMobileLabel?: boolean;
}

export function FavoriteButton({
  mangaId,
  title,
  coverUrl,
  variant = "icon",
  size = "md",
  className,
  compactMobileLabel = true,
}: Props) {
  const router = useRouter();
  const { isFavorite, isAuthenticated, add, remove } = useFavorites();
  const active = isFavorite(mangaId);
  const reduceMotion = useReducedMotion();
  const [optimisticSaved, setOptimisticSaved] = useState(false);
  const [settleKey, setSettleKey] = useState(0);
  const shownActive = active || optimisticSaved;
  const busy = add.isPending || remove.isPending;
  const settleInitial =
    settleKey === 0 ? false : reduceMotion ? { opacity: 0.7 } : { scale: 0.92, y: 2 };
  const settleAnimate =
    settleKey === 0 ? undefined : reduceMotion ? { opacity: 1 } : { scale: 1, y: 0 };

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (shownActive) {
      setOptimisticSaved(false);
      remove.mutate(mangaId);
    } else {
      setOptimisticSaved(true);
      setSettleKey((key) => key + 1);
      add.mutate(
        { mangaId, title, coverUrl },
        {
          onError: () => setOptimisticSaved(false),
        },
      );
    }
  };

  if (variant === "full") {
    return (
      <Button
        variant={shownActive ? "library" : "outline"}
        size={size}
        onClick={toggle}
        aria-pressed={shownActive}
        aria-label={
          shownActive ? `Remove ${title} from library` : `Add ${title} to library`
        }
        disabled={busy}
        className={className}
      >
        <motion.span
          key={settleKey}
          initial={settleInitial}
          animate={settleAnimate}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2"
        >
          <Heart
            aria-hidden="true"
            className={cn("h-4 w-4", shownActive && "fill-library text-library")}
          />
          {shownActive ? (
            compactMobileLabel ? (
              <>
                <span className="sm:hidden">Saved</span>
                <span className="hidden sm:inline">In your library</span>
              </>
            ) : (
              <span>In your library</span>
            )
          ) : (
            compactMobileLabel ? (
              <>
                <span className="sm:hidden">Save</span>
                <span className="hidden sm:inline">Add to library</span>
              </>
            ) : (
              <span>Add to library</span>
            )
          )}
        </motion.span>
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        shownActive ? `Remove ${title} from library` : `Add ${title} to library`
      }
      aria-pressed={shownActive}
      disabled={busy}
      className={cn(
        "grid h-11 w-11 place-items-center rounded-full bg-surface-spotlight/70 text-content-inverse [box-shadow:var(--elevation-panel)] backdrop-blur transition hover:bg-surface-spotlight/90 disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      <motion.span
        key={settleKey}
        initial={settleInitial}
        animate={settleAnimate}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <Heart
          aria-hidden="true"
          className={cn("h-4 w-4", shownActive && "fill-library text-library")}
        />
      </motion.span>
    </button>
  );
}
