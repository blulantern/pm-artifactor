import { expect, test } from "vitest";
import { INPUT_FOR } from "./inputs.js";

test("each spine type maps to its validator and rejects a missing name", () => {
  expect(INPUT_FOR.project.safeParse({ organizationId: "o", methodologyId: "m" }).success).toBe(false);
  expect(INPUT_FOR.portfolio.safeParse({ name: "P", organizationId: "o" }).success).toBe(true);
});
