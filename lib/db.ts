import { PrismaClient } from "@prisma/client";

// One client per process. Next's dev server reloads modules, so the instance
// is parked on globalThis to avoid opening a new pool on every edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
