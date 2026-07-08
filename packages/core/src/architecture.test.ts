import { execSync } from "node:child_process";
import { expect, test } from "vitest";

test("packages/core imports nothing infra (dependency rule)", () => {
  // depcruise exits 0 when no forbidden edges are found.
  const out = execSync("pnpm -w depcruise", { encoding: "utf8" });
  expect(out).not.toMatch(/error/i);
});
