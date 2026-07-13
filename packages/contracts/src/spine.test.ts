import { expect, test } from "vitest";
import { EntityRef, ProjectInput, SpineType } from "./spine.js";

test("SpineType accepts the four spine kinds and rejects others", () => {
  expect(SpineType.safeParse("product").success).toBe(true);
  expect(SpineType.safeParse("workitem").success).toBe(false);
});

test("EntityRef requires a non-empty id", () => {
  expect(EntityRef.safeParse({ type: "project", id: "p1" }).success).toBe(true);
  expect(EntityRef.safeParse({ type: "project", id: "" }).success).toBe(false);
});

test("ProjectInput requires name + org + methodology, allows null parents", () => {
  const ok = ProjectInput.safeParse({ name: "P", organizationId: "o1", methodologyId: "m1", portfolioId: null, programId: null, productId: null });
  expect(ok.success).toBe(true);
  expect(ProjectInput.safeParse({ name: "P", organizationId: "o1" }).success).toBe(false); // no methodology
});
