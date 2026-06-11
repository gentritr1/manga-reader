"use client";

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
}

export function FavoriteButton({
  mangaId,
  title,
  coverUrl,
  variant = "icon",
  size = "md",
  className,
}: Props) {
  const router = useRouter();
  const { isFavorite, isAuthenticated, add, remove } = useFavorites();
  const active = isFavorite(mangaId);
  const busy = add.isPending || remove.isPending;

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (active) remove.mutate(mangaId);
    else add.mutate({ mangaId, title, coverUrl });
  };

  if (variant === "full") {
    return (
      <Button
        variant={active ? "library" : "outline"}
        size={size}
        onClick={toggle}
        aria-pressed={active}
        aria-label={
          active ? `Remove ${title} from library` : `Add ${title} to library`
        }
        disabled={busy}
        className={className}
      >
        <Heart
          aria-hidden="true"
          className={cn("h-4 w-4", active && "fill-current text-library")}
        />
        {active ? (
          <>
            <span className="sm:hidden">Saved</span>
            <span className="hidden sm:inline">In your library</span>
          </>
        ) : (
          <>
            <span className="sm:hidden">Save</span>
            <span className="hidden sm:inline">Add to library</span>
          </>
        )}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        active ? `Remove ${title} from library` : `Add ${title} to library`
      }
      aria-pressed={active}
      disabled={busy}
      className={cn(
        "grid h-11 w-11 place-items-center rounded-full bg-surface-spotlight/70 text-content-inverse [box-shadow:var(--elevation-panel)] backdrop-blur transition hover:bg-surface-spotlight/90 disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      <Heart
        aria-hidden="true"
        className={cn("h-4 w-4", active && "fill-library text-library")}
      />
    </button>
  );
}
