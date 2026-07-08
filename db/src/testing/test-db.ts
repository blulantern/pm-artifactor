import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPrisma } from "../client.js";
import type { PrismaClient } from "@prisma/client";

export async function makeTestDb(): Promise<{
  prisma: PrismaClient;
  url: string;
  cleanup: () => Promise<void>;
}> {
  const dir = mkdtempSync(join(tmpdir(), "pma-test-"));
  const file = join(dir, "test.db");
  const url = `file:${file}`;
  // Apply the schema to the fresh file. Clean up the temp dir if push fails,
  // otherwise the cleanup closure below never gets a chance to run.
  try {
    execSync(`pnpm --filter @pma/db exec prisma db push --skip-generate`, {
      env: { ...process.env, DATABASE_URL: url },
      stdio: "ignore",
    });
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }
  const prisma = getPrisma(url);
  return {
    prisma,
    url,
    cleanup: async () => {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
