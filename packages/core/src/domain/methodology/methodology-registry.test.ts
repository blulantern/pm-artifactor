import { expect, test } from "vitest";
import { DefaultMethodologyRegistry } from "./methodology-registry.js";

test("registry resolves Scrum to a velocity+sprint profile", () => {
  const p = new DefaultMethodologyRegistry().resolve("SCRUM");
  expect(p.key).toBe("SCRUM");
  expect(p.metrics().key).toBe("VELOCITY");
});

test("registry resolves Waterfall to an earned-value profile", () => {
  const p = new DefaultMethodologyRegistry().resolve("WATERFALL");
  expect(p.metrics().key).toBe("EARNED_VALUE");
});

test("resolving an unregistered methodology throws (SAFe/DMAIC come with the seed data later)", () => {
  expect(() => new DefaultMethodologyRegistry().resolve("SAFE")).toThrow();
});
