import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { database?: PrismaClient };
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Missing DATABASE_URL for Prisma client.");

/** Privileged client for domain resolution and authorized platform management only. */
export const database = globalForPrisma.database ?? new PrismaClient({ adapter: new PrismaPg({ connectionString }), log: ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.database = database;
