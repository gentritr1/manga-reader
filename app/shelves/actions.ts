"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const allowedColorVibes = new Set([
  "indigo",
  "rose",
  "emerald",
  "amber",
  "cyan",
  "violet",
  "fuchsia",
  "orange",
  "slate",
]);

function isPrismaUniqueError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function createShelf(name: string, colorVibe: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const trimmedName = name.trim();
  if (!trimmedName) return { error: "Shelf name is required." };
  if (!allowedColorVibes.has(colorVibe)) {
    return { error: "Choose one of the available shelf colors." };
  }
  
  try {
    await prisma.shelf.create({
      data: {
        userId: session.user.id,
        name: trimmedName,
        colorVibe,
      }
    });
    revalidatePath("/shelves");
    return { success: true };
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      return { error: "You already have a shelf with this name." };
    }
    return { error: "Failed to create shelf." };
  }
}

export async function deleteShelf(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  
  try {
    await prisma.shelf.deleteMany({
      where: { id, userId: session.user.id }
    });
    revalidatePath("/shelves");
    return { success: true };
  } catch {
    return { error: "Failed to delete shelf." };
  }
}

export async function addToShelf(shelfId: string, mangaId: string, title: string, coverUrl: string | null) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  
  try {
    const shelf = await prisma.shelf.findUnique({ where: { id: shelfId } });
    if (!shelf || shelf.userId !== session.user.id) throw new Error("Unauthorized");

    await prisma.shelfItem.create({
      data: {
        shelfId,
        mangaId,
        title,
        coverUrl,
      }
    });
    revalidatePath("/manga/[id]", "page");
    revalidatePath("/shelves");
    return { success: true };
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) return { error: "Manga already in shelf" };
    return { error: "Failed to add to shelf" };
  }
}

export async function removeFromShelf(shelfId: string, mangaId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  
  try {
    const shelf = await prisma.shelf.findUnique({ where: { id: shelfId } });
    if (!shelf || shelf.userId !== session.user.id) throw new Error("Unauthorized");

    await prisma.shelfItem.deleteMany({
      where: { shelfId, mangaId }
    });
    revalidatePath("/manga/[id]", "page");
    revalidatePath("/shelves");
    return { success: true };
  } catch {
    return { error: "Failed to remove from shelf" };
  }
}
