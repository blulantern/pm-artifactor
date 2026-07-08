import { expect, test } from "vitest";
import { workItemId, projectId } from "./ids.js";

test("branded id constructors preserve the string value", () => {
  expect(workItemId("wi-1")).toBe("wi-1");
  expect(projectId("p-1")).toBe("p-1");
});
