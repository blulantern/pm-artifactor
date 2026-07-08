import { PrismaClient } from "@prisma/client";

let _prisma: PrismaClient | undefined;

/** Singleton PrismaClient. Pass a url to point at a specific DB (used by tests). */
export function getPrisma(url?: string): PrismaClient {
  if (url) return new PrismaClient({ datasources: { db: { url } } });
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}
