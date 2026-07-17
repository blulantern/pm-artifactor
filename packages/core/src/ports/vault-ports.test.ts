import { expect, test } from "vitest";
import { VaultLockedError } from "./credential-store-port.js";

test("VaultLockedError is an Error subclass with a stable name", () => {
  const e = new VaultLockedError();
  expect(e).toBeInstanceOf(Error);
  expect(e.name).toBe("VaultLockedError");
  expect(new VaultLockedError("custom").message).toBe("custom");
});
