import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "apps/**/*.test.tsx", "db/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    // Mirrors apps/web/tsconfig.json's "@/*" -> "./src/*" path alias (also applied for
    // Next/webpack in apps/web/next.config.mjs) so tests can use the same "@/..." imports
    // as app source. Scoped to a single "@" prefix used only by apps/web; no other
    // workspace package uses it.
    alias: {
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
});
