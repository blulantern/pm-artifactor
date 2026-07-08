import { getPrisma } from "@pma/db/src/client.js";
import type { PrismaClient } from "@prisma/client";

export const db = (): PrismaClient => getPrisma();
