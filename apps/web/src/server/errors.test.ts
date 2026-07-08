import { expect, test } from "vitest";
import { isRecordNotFound } from "./errors.js";

test("isRecordNotFound only matches Prisma P2025", () => {
  expect(isRecordNotFound({ code: "P2025" })).toBe(true);
  expect(isRecordNotFound({ code: "P1001" })).toBe(false); // connection error
  expect(isRecordNotFound(new Error("boom"))).toBe(false);
  expect(isRecordNotFound(null)).toBe(false);
  expect(isRecordNotFound("nope")).toBe(false);
});
