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
    <main className="flex-1 w-full bg-surface-canvas">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="mb-10 max-w-2xl space-y-3">
          <h1 className="text-4xl font-black tracking-tight text-content-primary sm:text-5xl">
            Your shelves
          </h1>
          <p className="text-base leading-relaxed text-content-secondary sm:text-lg">
            Group titles into collections you actually come back to: what you&rsquo;re
            reading, what&rsquo;s finished, the weekend binge pile. Save any shelf as an
            image to share.
          </p>
        </div>
        <ShelvesClient initialShelves={shelves} />
      </div>
    </main>
  );
}
