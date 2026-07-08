import { expect, test } from "vitest";
import { workItemStatusChanged } from "./work-item-events.js";
import { workItemId } from "../shared/ids.js";

test("status-changed event carries from/to and aggregate id", () => {
  const at = new Date("2026-03-16T09:00:00Z");
  const e = workItemStatusChanged(workItemId("wi-1"), "todo", "in_progress", at);
  expect(e.type).toBe("WorkItemStatusChanged");
  expect(e.aggregateId).toBe("wi-1");
  expect(e.from).toBe("todo");
  expect(e.to).toBe("in_progress");
  expect(e.occurredAt).toBe(at);
});
