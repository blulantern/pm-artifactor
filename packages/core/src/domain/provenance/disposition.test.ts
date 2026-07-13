import { expect, test } from "vitest";
import { resolveDelete } from "./disposition.js";

const parent = { type: "portfolio" as const, id: "port1" };
const a = { type: "program" as const, id: "prog1" };
const b = { type: "project" as const, id: "proj1" };

test("parent is always archived; kept children detach, archived children archive", () => {
  const r = resolveDelete(parent, [
    { ref: a, disposition: "keep" },
    { ref: b, disposition: "archive" },
  ]);
  expect(r.archive).toEqual([parent, b]);
  expect(r.detach).toEqual([a]);
});

test("no children → only the parent is archived", () => {
  expect(resolveDelete(parent, [])).toEqual({ archive: [parent], detach: [] });
});
