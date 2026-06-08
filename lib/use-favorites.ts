"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export interface FavoriteRecord {
  id: string;
  mangaId: string;
  title: string;
  coverUrl: string | null;
  createdAt: string;
}

async function fetchFavorites(): Promise<FavoriteRecord[]> {
  const res = await fetch("/api/favorites");
  if (!res.ok) return [];
  const json = (await res.json()) as { favorites: FavoriteRecord[] };
  return json.favorites;
}

export function useFavorites() {
  const { status } = useSession();
  const qc = useQueryClient();
  const enabled = status === "authenticated";

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: fetchFavorites,
    enabled,
  });

  const add = useMutation({
    mutationFn: async (input: {
      mangaId: string;
      title: string;
      coverUrl?: string | null;
    }) => {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const remove = useMutation({
    mutationFn: async (mangaId: string) => {
      await fetch(`/api/favorites?mangaId=${encodeURIComponent(mangaId)}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  return {
    favorites,
    isLoading,
    isAuthenticated: enabled,
    isFavorite: (mangaId: string) =>
      favorites.some((f) => f.mangaId === mangaId),
    add,
    remove,
  };
}
