import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { FavoritesGrid } from "@/components/favorites/favorites-grid";

export const metadata: Metadata = { title: "My Library" };

export default async function FavoritesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/favorites");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">My Library</h1>
      <FavoritesGrid />
    </div>
  );
}
