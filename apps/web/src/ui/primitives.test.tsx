import { expect, test } from "vitest";
import { healthColor, initials } from "./format.js";

test("healthColor thresholds match the POC", () => {
  expect(healthColor(86)).toContain("win");
  expect(healthColor(70)).toContain("amber");
  expect(healthColor(59)).toContain("flag");
});

test("initials takes the first two word-initials", () => {
  expect(initials("Dana Okafor")).toBe("DO");
  expect(initials("Theo Adékúnlé")).toBe("TA");
});
