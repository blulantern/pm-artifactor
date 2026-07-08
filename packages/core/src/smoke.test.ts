import { expect, test } from "vitest";
import { CORE_VERSION } from "./index.js";

test("core package loads", () => {
  expect(CORE_VERSION).toBe("0.0.0");
});
