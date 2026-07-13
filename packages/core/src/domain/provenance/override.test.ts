import { expect, test } from "vitest";
import { applyEdit, mergePull, sever } from "./override.js";

test("manual edit does not track override fields", () => {
  const r = applyEdit({ name: "A", status: "planning" }, { name: "B" }, { connected: false, overriddenFields: [] });
  expect(r.values).toEqual({ name: "B", status: "planning" });
  expect(r.overriddenFields).toEqual([]);
});

test("connected edit records changed fields as overrides (deduped)", () => {
  const r1 = applyEdit({ name: "A", status: "planning" }, { name: "B" }, { connected: true, overriddenFields: [] });
  expect(r1.overriddenFields).toEqual(["name"]);
  const r2 = applyEdit({ name: "B", status: "planning" }, { name: "C" }, { connected: true, overriddenFields: ["name"] });
  expect(r2.overriddenFields).toEqual(["name"]);
});

test("mergePull keeps overridden fields and takes pulled values elsewhere", () => {
  const merged = mergePull({ name: "local", status: "done" }, { name: "remote", status: "planning" }, ["name"]);
  expect(merged).toEqual({ name: "local", status: "planning" });
});

test("sever clears the override set", () => {
  expect(sever(["name", "status"])).toEqual({ overriddenFields: [] });
});
