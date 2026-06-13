import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ShelvesClient } from "./shelves-client";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "My Shelves",
  description: "Create custom vibe-based shelves to share.",
};

export default async function ShelvesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/shelves");
  }

  const shelves = await prisma.shelf.findMany({
    where: { userId: session.user.id },
    include: { items: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="flex-1 w-full bg-surface-canvas min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="mb-16 space-y-4 max-w-3xl">
          <h1 className="text-5xl font-black tracking-tight text-content-primary sm:text-6xl drop-shadow-sm">
            Your Shelves
          </h1>
          <p className="text-lg text-content-secondary font-medium leading-relaxed">
            Curate your distinct reading vibe. Build custom collections and export beautiful images to share on social media.
          </p>
        </div>
        <ShelvesClient initialShelves={shelves} />
      </div>
    </main>
  );
}
