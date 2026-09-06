import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// Prisma auto-loads .env from the schema directory (packages/db/.env) which may
// point to a different database. Override with the process-level DATABASE_URL so
// the frontend always connects to the intended instance.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
