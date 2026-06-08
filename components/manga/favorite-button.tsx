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
  className?: string;
}

export function FavoriteButton({
  mangaId,
  title,
  coverUrl,
  variant = "icon",
  className,
}: Props) {
  const router = useRouter();
  const { isFavorite, isAuthenticated, add, remove } = useFavorites();
  const active = isFavorite(mangaId);

  const toggle = (e: React.MouseEvent) => {
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
        variant={active ? "secondary" : "default"}
        onClick={toggle}
        className={className}
      >
        <Heart className={cn("h-4 w-4", active && "fill-current text-red-500")} />
        {active ? "In your library" : "Add to library"}
      </Button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={active ? "Remove from library" : "Add to library"}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", active && "fill-red-500 text-red-500")} />
    </button>
  );
}
