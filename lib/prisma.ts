// Prisma reads DATABASE_URL from the datasource in prisma/schema.prisma. On
// Vercel serverless that URL MUST be a POOLED connection string (Neon pooler /
// Supabase 6543 / Prisma Accelerate); migrations use the separate unpooled
// DIRECT_URL. See .env.example and docs/vercel-cache-strategy.md.
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return process.env.DATABASE_URL?.startsWith("prisma://")
    ? (client.$extends(withAccelerate()) as unknown as PrismaClient)
    : client;
}

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
